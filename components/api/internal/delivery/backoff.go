package delivery

import "time"

// MaxAttempts is how many tries a delivery chain gets before it dead-letters.
const MaxAttempts = 5

// backoffSchedule[n-1] is the wait after attempt n fails: 30s, 2m, 10m, 30m.
// A failure on attempt MaxAttempts (or later — replays number past it) has no
// entry: it dead-letters instead.
var backoffSchedule = []time.Duration{
	30 * time.Second,
	2 * time.Minute,
	10 * time.Minute,
	30 * time.Minute,
}

// BackoffDelay returns the wait before the retry that follows a failure of
// attempt n, and whether a retry happens at all.
func BackoffDelay(n int) (time.Duration, bool) {
	if n < 1 || n >= MaxAttempts {
		return 0, false
	}
	return backoffSchedule[n-1], true
}

// Decision is what happens to an attempt (and its event) after an HTTP try.
type Decision struct {
	AttemptStatus string
	EventStatus   string
	// Retry means a follow-up attempt (AttemptNumber+1) is enqueued, due
	// NextDelay from now.
	Retry     bool
	NextDelay time.Duration
}

// Decide maps the outcome of a real HTTP try onto the state machine.
// connErr means the request never produced a response (statusCode is
// recorded as 0 in that case).
func Decide(attemptNumber, statusCode int, connErr bool) Decision {
	if !connErr && statusCode >= 200 && statusCode < 300 {
		return Decision{AttemptStatus: StatusSuccess, EventStatus: EventDelivered}
	}
	delay, ok := BackoffDelay(attemptNumber)
	if !ok {
		return Decision{AttemptStatus: StatusDead, EventStatus: EventDead}
	}
	return Decision{
		AttemptStatus: StatusFailed,
		EventStatus:   EventPending,
		Retry:         true,
		NextDelay:     delay,
	}
}
