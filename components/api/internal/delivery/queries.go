package delivery

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

var (
	// ErrNotFound is returned when an event or attempt id does not exist.
	ErrNotFound = errors.New("not found")
	// ErrNotDead is returned when replaying an attempt that is not in the DLQ.
	ErrNotDead = errors.New("attempt is not dead")
)

// Ingest stores an event and enqueues one pending attempt per active
// endpoint, due immediately.
func (s *Store) Ingest(ctx context.Context, typ string, payload json.RawMessage) (*Event, []Attempt, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, nil, err
	}
	defer tx.Rollback()

	evt := &Event{
		ID:      newID("evt"),
		Type:    typ,
		Payload: payload,
		Status:  EventPending,
	}
	if err := tx.QueryRowContext(ctx, `
		INSERT INTO events (id, type, payload, status)
		VALUES ($1, $2, $3, $4)
		RETURNING created_at`,
		evt.ID, evt.Type, string(evt.Payload), evt.Status).Scan(&evt.CreatedAt); err != nil {
		return nil, nil, fmt.Errorf("insert event: %w", err)
	}

	rows, err := tx.QueryContext(ctx, `SELECT id FROM endpoints WHERE active ORDER BY created_at`)
	if err != nil {
		return nil, nil, fmt.Errorf("list active endpoints: %w", err)
	}
	var endpointIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, nil, err
		}
		endpointIDs = append(endpointIDs, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	attempts := make([]Attempt, 0, len(endpointIDs))
	for _, epID := range endpointIDs {
		att := Attempt{
			ID:            newID("att"),
			EventID:       evt.ID,
			EndpointID:    epID,
			AttemptNumber: 1,
			Status:        StatusPending,
		}
		var next time.Time
		if err := tx.QueryRowContext(ctx, `
			INSERT INTO delivery_attempts (id, event_id, endpoint_id, attempt_number, status, next_retry_at)
			VALUES ($1, $2, $3, $4, $5, now())
			RETURNING next_retry_at, created_at`,
			att.ID, att.EventID, att.EndpointID, att.AttemptNumber, att.Status).
			Scan(&next, &att.CreatedAt); err != nil {
			return nil, nil, fmt.Errorf("insert attempt: %w", err)
		}
		att.NextRetryAt = &next
		attempts = append(attempts, att)
	}

	if err := tx.Commit(); err != nil {
		return nil, nil, err
	}
	return evt, attempts, nil
}

func (s *Store) ListEndpoints(ctx context.Context) ([]Endpoint, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, url, active, created_at
		FROM endpoints ORDER BY created_at DESC, id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Endpoint{}
	for rows.Next() {
		var ep Endpoint
		if err := rows.Scan(&ep.ID, &ep.Name, &ep.URL, &ep.Active, &ep.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, ep)
	}
	return out, rows.Err()
}

func (s *Store) ListEvents(ctx context.Context, limit int) ([]Event, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, type, payload, status, created_at
		FROM events ORDER BY created_at DESC, id LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Event{}
	for rows.Next() {
		var evt Event
		var payload []byte
		if err := rows.Scan(&evt.ID, &evt.Type, &payload, &evt.Status, &evt.CreatedAt); err != nil {
			return nil, err
		}
		evt.Payload = json.RawMessage(payload)
		out = append(out, evt)
	}
	return out, rows.Err()
}

const attemptColumns = `
	a.id, a.event_id, a.endpoint_id, a.attempt_number, a.status,
	a.response_code, a.latency_ms, a.next_retry_at, a.created_at,
	e.type, ep.name, ep.url`

func scanAttempt(scan func(dest ...any) error) (Attempt, error) {
	var att Attempt
	err := scan(
		&att.ID, &att.EventID, &att.EndpointID, &att.AttemptNumber, &att.Status,
		&att.ResponseCode, &att.LatencyMS, &att.NextRetryAt, &att.CreatedAt,
		&att.EventType, &att.EndpointName, &att.EndpointURL,
	)
	return att, err
}

// GetEventWithAttempts returns an event and its attempt history (all
// endpoints, ordered by attempt number).
func (s *Store) GetEventWithAttempts(ctx context.Context, id string) (*Event, []Attempt, error) {
	var evt Event
	var payload []byte
	err := s.db.QueryRowContext(ctx, `
		SELECT id, type, payload, status, created_at FROM events WHERE id = $1`, id).
		Scan(&evt.ID, &evt.Type, &payload, &evt.Status, &evt.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil, ErrNotFound
	}
	if err != nil {
		return nil, nil, err
	}
	evt.Payload = json.RawMessage(payload)

	rows, err := s.db.QueryContext(ctx, `
		SELECT `+attemptColumns+`
		FROM delivery_attempts a
		JOIN events e ON e.id = a.event_id
		JOIN endpoints ep ON ep.id = a.endpoint_id
		WHERE a.event_id = $1
		ORDER BY a.attempt_number, a.created_at`, id)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	attempts := []Attempt{}
	for rows.Next() {
		att, err := scanAttempt(rows.Scan)
		if err != nil {
			return nil, nil, err
		}
		attempts = append(attempts, att)
	}
	return &evt, attempts, rows.Err()
}

// ListDLQ returns every dead attempt, newest first.
func (s *Store) ListDLQ(ctx context.Context) ([]Attempt, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT `+attemptColumns+`
		FROM delivery_attempts a
		JOIN events e ON e.id = a.event_id
		JOIN endpoints ep ON ep.id = a.endpoint_id
		WHERE a.status = 'dead'
		ORDER BY a.created_at DESC, a.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Attempt{}
	for rows.Next() {
		att, err := scanAttempt(rows.Scan)
		if err != nil {
			return nil, err
		}
		out = append(out, att)
	}
	return out, rows.Err()
}

// Replay re-queues a dead attempt: the dead row leaves the DLQ (status
// 'failed'), a fresh pending attempt is enqueued due now, and the event goes
// back to pending. If the new attempt fails it dead-letters again immediately
// (its number is past MaxAttempts), so a replay is exactly one more real try.
func (s *Store) Replay(ctx context.Context, attemptID string) (*Attempt, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var eventID, endpointID, status string
	var number int
	err = tx.QueryRowContext(ctx, `
		SELECT event_id, endpoint_id, attempt_number, status
		FROM delivery_attempts WHERE id = $1 FOR UPDATE`, attemptID).
		Scan(&eventID, &endpointID, &number, &status)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if status != StatusDead {
		return nil, ErrNotDead
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE delivery_attempts SET status = 'failed' WHERE id = $1`, attemptID); err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE events SET status = 'pending' WHERE id = $1`, eventID); err != nil {
		return nil, err
	}

	att := Attempt{
		ID:            newID("att"),
		EventID:       eventID,
		EndpointID:    endpointID,
		AttemptNumber: number + 1,
		Status:        StatusPending,
	}
	var next time.Time
	if err := tx.QueryRowContext(ctx, `
		INSERT INTO delivery_attempts (id, event_id, endpoint_id, attempt_number, status, next_retry_at)
		VALUES ($1, $2, $3, $4, $5, now())
		RETURNING next_retry_at, created_at`,
		att.ID, att.EventID, att.EndpointID, att.AttemptNumber, att.Status).
		Scan(&next, &att.CreatedAt); err != nil {
		return nil, err
	}
	att.NextRetryAt = &next

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &att, nil
}

// GetStats computes the dashboard rollup.
func (s *Store) GetStats(ctx context.Context) (*Stats, error) {
	st := &Stats{}
	err := s.db.QueryRowContext(ctx, `
		SELECT
			(SELECT count(*) FROM events WHERE created_at > now() - interval '24 hours'),
			(SELECT count(DISTINCT event_id) FROM delivery_attempts
				WHERE status = 'success' AND created_at > now() - interval '24 hours'),
			(SELECT count(*) FROM delivery_attempts WHERE status = 'dead'),
			(SELECT count(*) FROM endpoints WHERE active)`).
		Scan(&st.Events24h, &st.Delivered24h, &st.DLQDepth, &st.EndpointsActive)
	if err != nil {
		return nil, err
	}

	var succ, resolved int
	err = s.db.QueryRowContext(ctx, `
		SELECT
			count(*) FILTER (WHERE status = 'success'),
			count(*)
		FROM delivery_attempts
		WHERE status IN ('success', 'failed', 'dead')
		AND created_at > now() - interval '24 hours'`).Scan(&succ, &resolved)
	if err != nil {
		return nil, err
	}
	if resolved == 0 {
		st.SuccessRate = 1
	} else {
		st.SuccessRate = float64(int(float64(succ)/float64(resolved)*1000+0.5)) / 1000
	}
	return st, nil
}
