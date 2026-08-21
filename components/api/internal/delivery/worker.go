package delivery

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"net/http"
	"os"
	"strconv"
	"time"

	"go.uber.org/zap"
)

const (
	// pollInterval is how long the worker sleeps when no attempt is due.
	pollInterval = 3 * time.Second
	// deliverTimeout bounds each real HTTP POST to a destination.
	deliverTimeout = 10 * time.Second
)

// RunWorker is the delivery engine entrypoint (RELAY_MODE=worker and the
// /bin/worker compat binary). It serves /livez and /readyz on HEALTH_ADDR,
// opens the store (waiting for Postgres), and then drains due attempts
// forever.
func RunWorker(l *zap.Logger) {
	listenAddr := os.Getenv("HEALTH_ADDR")
	if listenAddr == "" {
		listenAddr = ":8090"
	}
	mux := http.NewServeMux()
	ok := func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}
	mux.HandleFunc("/livez", ok)
	mux.HandleFunc("/readyz", ok)
	go func() {
		l.Info("worker health server listening", zap.String("addr", listenAddr))
		if err := http.ListenAndServe(listenAddr, mux); err != nil {
			l.Fatal("worker health server failed", zap.Error(err))
		}
	}()

	ctx := context.Background()
	store, err := Open(ctx, ConfigFromEnv(), l)
	if err != nil {
		l.Fatal("unable to open delivery store", zap.Error(err))
	}
	defer store.Close()

	client := &http.Client{Timeout: deliverTimeout}
	l.Info("delivery engine started",
		zap.Duration("poll_interval", pollInterval),
		zap.Int("max_attempts", MaxAttempts))

	for {
		processed, err := store.ProcessOne(ctx, client, l)
		if err != nil {
			l.Error("delivery pass failed", zap.Error(err))
			time.Sleep(pollInterval)
			continue
		}
		if !processed {
			time.Sleep(pollInterval)
		}
	}
}

// ProcessOne claims the next due pending attempt (FOR UPDATE SKIP LOCKED, so
// concurrent workers never double-deliver), makes the real HTTP POST, records
// the response code and latency, and applies the state machine: success,
// retry with backoff, or dead-letter. Returns false when nothing was due.
func (s *Store) ProcessOne(ctx context.Context, client *http.Client, l *zap.Logger) (bool, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	var (
		attID, eventID, endpointID string
		number                     int
		eventType, url             string
		payload                    []byte
	)
	err = tx.QueryRowContext(ctx, `
		SELECT a.id, a.event_id, a.endpoint_id, a.attempt_number, e.type, e.payload, ep.url
		FROM delivery_attempts a
		JOIN events e ON e.id = a.event_id
		JOIN endpoints ep ON ep.id = a.endpoint_id
		WHERE a.status = 'pending' AND a.next_retry_at <= now()
		ORDER BY a.next_retry_at
		LIMIT 1
		FOR UPDATE OF a SKIP LOCKED`).
		Scan(&attID, &eventID, &endpointID, &number, &eventType, &payload, &url)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	code, latency, connErr := deliver(ctx, client, url, eventID, eventType, number, payload)
	decision := Decide(number, code, connErr)

	if _, err := tx.ExecContext(ctx, `
		UPDATE delivery_attempts
		SET status = $2, response_code = $3, latency_ms = $4, next_retry_at = NULL
		WHERE id = $1`,
		attID, decision.AttemptStatus, code, latency); err != nil {
		return false, err
	}

	switch decision.AttemptStatus {
	case StatusSuccess:
		if _, err := tx.ExecContext(ctx, `
			UPDATE events SET status = 'delivered' WHERE id = $1`, eventID); err != nil {
			return false, err
		}
	case StatusDead:
		if _, err := tx.ExecContext(ctx, `
			UPDATE events SET status = 'dead' WHERE id = $1 AND status <> 'delivered'`, eventID); err != nil {
			return false, err
		}
	}

	if decision.Retry {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO delivery_attempts (id, event_id, endpoint_id, attempt_number, status, next_retry_at)
			VALUES ($1, $2, $3, $4, 'pending', now() + $5 * interval '1 second')`,
			newID("att"), eventID, endpointID, number+1, int(decision.NextDelay.Seconds())); err != nil {
			return false, err
		}
	}

	if err := tx.Commit(); err != nil {
		return false, err
	}

	l.Info("delivery attempt resolved",
		zap.String("attempt", attID),
		zap.String("event", eventID),
		zap.String("endpoint", endpointID),
		zap.Int("attempt_number", number),
		zap.Int("response_code", code),
		zap.Int("latency_ms", latency),
		zap.String("result", decision.AttemptStatus),
		zap.Bool("retry_enqueued", decision.Retry))
	return true, nil
}

// deliver makes the real HTTP POST. A connection-level failure returns
// connErr=true with code 0.
func deliver(ctx context.Context, client *http.Client, url, eventID, eventType string, number int, payload []byte) (code, latencyMS int, connErr bool) {
	reqCtx, cancel := context.WithTimeout(ctx, deliverTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return 0, 0, true
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Relay-Event-Id", eventID)
	req.Header.Set("X-Relay-Event-Type", eventType)
	req.Header.Set("X-Relay-Attempt", strconv.Itoa(number))

	start := time.Now()
	resp, err := client.Do(req)
	latencyMS = int(time.Since(start).Milliseconds())
	if err != nil {
		return 0, latencyMS, true
	}
	defer resp.Body.Close()
	return resp.StatusCode, latencyMS, false
}
