package delivery

import (
	"testing"
	"time"
)

func TestBackoffDelay(t *testing.T) {
	tests := []struct {
		name    string
		attempt int
		want    time.Duration
		retries bool
	}{
		{"after attempt 1", 1, 30 * time.Second, true},
		{"after attempt 2", 2, 2 * time.Minute, true},
		{"after attempt 3", 3, 10 * time.Minute, true},
		{"after attempt 4", 4, 30 * time.Minute, true},
		{"attempt 5 is the last", 5, 0, false},
		{"replayed attempt past the cap", 6, 0, false},
		{"nonsense attempt zero", 0, 0, false},
		{"nonsense negative attempt", -3, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := BackoffDelay(tt.attempt)
			if ok != tt.retries {
				t.Fatalf("BackoffDelay(%d) retry = %v, want %v", tt.attempt, ok, tt.retries)
			}
			if got != tt.want {
				t.Fatalf("BackoffDelay(%d) = %v, want %v", tt.attempt, got, tt.want)
			}
		})
	}
}

func TestDecide(t *testing.T) {
	tests := []struct {
		name       string
		attempt    int
		statusCode int
		connErr    bool
		want       Decision
	}{
		{
			"200 on first attempt delivers",
			1, 200, false,
			Decision{AttemptStatus: StatusSuccess, EventStatus: EventDelivered},
		},
		{
			"204 counts as success",
			3, 204, false,
			Decision{AttemptStatus: StatusSuccess, EventStatus: EventDelivered},
		},
		{
			"success on the final attempt still delivers",
			5, 200, false,
			Decision{AttemptStatus: StatusSuccess, EventStatus: EventDelivered},
		},
		{
			"503 on attempt 1 retries in 30s",
			1, 503, false,
			Decision{AttemptStatus: StatusFailed, EventStatus: EventPending, Retry: true, NextDelay: 30 * time.Second},
		},
		{
			"404 on attempt 2 retries in 2m",
			2, 404, false,
			Decision{AttemptStatus: StatusFailed, EventStatus: EventPending, Retry: true, NextDelay: 2 * time.Minute},
		},
		{
			"connection error on attempt 4 retries in 30m",
			4, 0, true,
			Decision{AttemptStatus: StatusFailed, EventStatus: EventPending, Retry: true, NextDelay: 30 * time.Minute},
		},
		{
			"failure on attempt 5 dead-letters",
			5, 500, false,
			Decision{AttemptStatus: StatusDead, EventStatus: EventDead},
		},
		{
			"connection error on attempt 5 dead-letters",
			5, 0, true,
			Decision{AttemptStatus: StatusDead, EventStatus: EventDead},
		},
		{
			"replayed attempt 6 failing goes straight back to dead",
			6, 502, false,
			Decision{AttemptStatus: StatusDead, EventStatus: EventDead},
		},
		{
			"replayed attempt 6 succeeding delivers",
			6, 200, false,
			Decision{AttemptStatus: StatusSuccess, EventStatus: EventDelivered},
		},
		{
			"3xx is not success",
			1, 301, false,
			Decision{AttemptStatus: StatusFailed, EventStatus: EventPending, Retry: true, NextDelay: 30 * time.Second},
		},
		{
			"connection error with a stale 200 code is not success",
			1, 200, true,
			Decision{AttemptStatus: StatusFailed, EventStatus: EventPending, Retry: true, NextDelay: 30 * time.Second},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Decide(tt.attempt, tt.statusCode, tt.connErr)
			if got != tt.want {
				t.Fatalf("Decide(%d, %d, %v) = %+v, want %+v", tt.attempt, tt.statusCode, tt.connErr, got, tt.want)
			}
		})
	}
}
