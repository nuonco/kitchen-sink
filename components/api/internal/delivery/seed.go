package delivery

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"go.uber.org/zap"
)

// seed inserts the default destinations and ~30 historical events with their
// attempt histories, so a first deploy shows a live dashboard: mostly
// delivered on the first try, several retried-then-delivered, and three dead
// chains parked in the DLQ.
//
// Every row has a fixed id and is inserted with ON CONFLICT DO NOTHING, so
// re-running (every api/worker start) changes nothing once the rows exist.
// These are seed rows only — everything that happens after them (the
// event-generator CronJob -> /ingest -> the worker -> the echo receiver) is a
// real end-to-end delivery.
func seed(ctx context.Context, conn *sql.Conn, l *zap.Logger) error {
	// The in-chart echo receiver is the pre-registered default destination:
	// every delivery to it is a real in-cluster HTTP round-trip.
	endpoints := []struct {
		id, name, url string
		active        bool
	}{
		{"ep_echo_default", "relay-echo (in-cluster echo receiver)", "http://relay-echo:8081/webhook", true},
		// Inactive example: shows what a registered external destination
		// looks like without Relay ever posting to a domain nobody owns.
		{"ep_example_external", "example external consumer (inactive)", "https://webhooks.example.com/relay", false},
	}
	for _, ep := range endpoints {
		if _, err := conn.ExecContext(ctx, `
			INSERT INTO endpoints (id, name, url, active)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (id) DO NOTHING`,
			ep.id, ep.name, ep.url, ep.active); err != nil {
			return fmt.Errorf("seed endpoint %s: %w", ep.id, err)
		}
	}

	types := []struct {
		typ, payload string
	}{
		{"invoice.created", `{"invoice_id": "in_58201", "amount_cents": 129900, "currency": "usd"}`},
		{"invoice.paid", `{"invoice_id": "in_58201", "amount_cents": 129900, "paid_via": "card"}`},
		{"user.signup", `{"user_id": "usr_90412", "plan": "team", "referrer": "docs"}`},
		{"payment.succeeded", `{"charge_id": "ch_77120", "amount_cents": 4900, "currency": "usd"}`},
		{"payment.failed", `{"charge_id": "ch_77121", "amount_cents": 4900, "decline_code": "insufficient_funds"}`},
		{"subscription.updated", `{"subscription_id": "sub_31007", "from_plan": "starter", "to_plan": "team"}`},
		{"build.completed", `{"build_id": "bld_66023", "duration_seconds": 142, "result": "passed"}`},
		{"deploy.finished", `{"deploy_id": "dep_20931", "environment": "production", "version": "v1.42.0"}`},
		{"cart.abandoned", `{"cart_id": "crt_10238", "items": 3, "value_cents": 15800}`},
		{"user.deleted", `{"user_id": "usr_88213", "reason": "requested"}`},
	}

	const total = 30
	now := time.Now().UTC()
	deadSet := map[int]bool{6: true, 16: true, 26: true}
	retriedSet := map[int]bool{3: true, 9: true, 13: true, 19: true, 23: true}

	insertEvent := func(id, typ, payload, status string, createdAt time.Time) error {
		_, err := conn.ExecContext(ctx, `
			INSERT INTO events (id, type, payload, status, created_at)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (id) DO NOTHING`,
			id, typ, payload, status, createdAt)
		return err
	}
	insertAttempt := func(id, eventID string, n int, status string, code, latency int, createdAt time.Time) error {
		_, err := conn.ExecContext(ctx, `
			INSERT INTO delivery_attempts
				(id, event_id, endpoint_id, attempt_number, status, response_code, latency_ms, next_retry_at, created_at)
			VALUES ($1, $2, 'ep_echo_default', $3, $4, $5, $6, NULL, $7)
			ON CONFLICT (id) DO NOTHING`,
			id, eventID, n, status, code, latency, createdAt)
		return err
	}

	seeded := 0
	for i := 1; i <= total; i++ {
		evtID := fmt.Sprintf("evt_seed_%02d", i)
		t := types[(i-1)%len(types)]
		// Spread the history over the last ~20 hours, newest last.
		createdAt := now.Add(-21*time.Hour + time.Duration(i)*40*time.Minute)
		latency := 18 + (i*13)%90 // deterministic, plausible ms

		switch {
		case deadSet[i]:
			// A dead chain: five real-looking failures, the last one parked
			// in the DLQ. Codes alternate between connection errors and 5xx.
			// Placed ~30h back: the DLQ counts all time, so these still show,
			// without a wall of stale failures skewing the 24h success rate.
			createdAt = now.Add(-31*time.Hour + time.Duration(i)*10*time.Minute)
			if err := insertEvent(evtID, t.typ, t.payload, EventDead, createdAt); err != nil {
				return err
			}
			at := createdAt
			for n := 1; n <= MaxAttempts; n++ {
				status := StatusFailed
				if n == MaxAttempts {
					status = StatusDead
				}
				code := 503
				if (i+n)%2 == 0 {
					code = 0 // connection refused
				}
				attID := fmt.Sprintf("att_seed_%02d_%d", i, n)
				if err := insertAttempt(attID, evtID, n, status, code, latency+n*7, at); err != nil {
					return err
				}
				if delay, ok := BackoffDelay(n); ok {
					at = at.Add(delay)
				}
			}
		case retriedSet[i]:
			// Failed once (or twice), then delivered on a retry.
			if err := insertEvent(evtID, t.typ, t.payload, EventDelivered, createdAt); err != nil {
				return err
			}
			fails := 1 + i%2
			at := createdAt
			for n := 1; n <= fails; n++ {
				attID := fmt.Sprintf("att_seed_%02d_%d", i, n)
				if err := insertAttempt(attID, evtID, n, StatusFailed, 503, latency+n*11, at); err != nil {
					return err
				}
				delay, _ := BackoffDelay(n)
				at = at.Add(delay)
			}
			attID := fmt.Sprintf("att_seed_%02d_%d", i, fails+1)
			if err := insertAttempt(attID, evtID, fails+1, StatusSuccess, 200, latency, at); err != nil {
				return err
			}
		default:
			// Delivered on the first attempt.
			if err := insertEvent(evtID, t.typ, t.payload, EventDelivered, createdAt); err != nil {
				return err
			}
			attID := fmt.Sprintf("att_seed_%02d_1", i)
			if err := insertAttempt(attID, evtID, 1, StatusSuccess, 200, latency, createdAt.Add(time.Second)); err != nil {
				return err
			}
		}
		seeded++
	}

	l.Info("seed applied", zap.Int("events", seeded))
	return nil
}
