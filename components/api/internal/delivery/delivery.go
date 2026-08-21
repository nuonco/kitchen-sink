// Package delivery is Relay's delivery engine: a Postgres-backed queue of
// webhook delivery attempts, the HTTP handlers that expose it, and the worker
// loop that drains it. Everything here is real — the worker makes real HTTP
// POSTs to registered endpoints and records what actually happened.
package delivery

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"
)

// Attempt statuses.
const (
	StatusPending = "pending"
	StatusSuccess = "success"
	StatusFailed  = "failed"
	StatusDead    = "dead"
)

// Event statuses.
const (
	EventPending   = "pending"
	EventDelivered = "delivered"
	EventDead      = "dead"
)

// Endpoint is a registered delivery destination.
type Endpoint struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	URL       string    `json:"url"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at"`
}

// Event is an ingested webhook event.
type Event struct {
	ID        string          `json:"id"`
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload"`
	Status    string          `json:"status"`
	CreatedAt time.Time       `json:"created_at"`
}

// Attempt is one delivery try of an event to an endpoint. ResponseCode and
// LatencyMS are null until the attempt resolves; ResponseCode 0 means the
// connection itself failed. The event/endpoint fields are denormalized into
// list responses so the console can render a row without extra fetches.
type Attempt struct {
	ID            string     `json:"id"`
	EventID       string     `json:"event_id"`
	EndpointID    string     `json:"endpoint_id"`
	AttemptNumber int        `json:"attempt_number"`
	Status        string     `json:"status"`
	ResponseCode  *int       `json:"response_code"`
	LatencyMS     *int       `json:"latency_ms"`
	NextRetryAt   *time.Time `json:"next_retry_at"`
	CreatedAt     time.Time  `json:"created_at"`

	EventType    string `json:"event_type,omitempty"`
	EndpointName string `json:"endpoint_name,omitempty"`
	EndpointURL  string `json:"endpoint_url,omitempty"`
}

// Stats is the dashboard rollup.
type Stats struct {
	Events24h       int     `json:"events_24h"`
	Delivered24h    int     `json:"delivered_24h"`
	SuccessRate     float64 `json:"success_rate"`
	DLQDepth        int     `json:"dlq_depth"`
	EndpointsActive int     `json:"endpoints_active"`
}

// newID returns a prefixed random id, e.g. "evt_1a2b3c4d5e6f7a8b".
func newID(prefix string) string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err != nil {
		// crypto/rand failing is unrecoverable; fall back to a timestamp so
		// the insert still has a unique-enough key rather than panicking.
		return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
	}
	return prefix + "_" + hex.EncodeToString(b)
}
