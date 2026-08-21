-- Relay delivery store schema. Applied at api and worker start under an
-- advisory lock; every statement is idempotent so a restart against either a
-- fresh emptyDir database or an already-migrated one is a no-op.

CREATE TABLE IF NOT EXISTS endpoints (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    url        TEXT NOT NULL,
    active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL,
    payload    JSONB NOT NULL,
    status     TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_attempts (
    id             TEXT PRIMARY KEY,
    event_id       TEXT NOT NULL REFERENCES events (id),
    endpoint_id    TEXT NOT NULL REFERENCES endpoints (id),
    attempt_number INTEGER NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',
    response_code  INTEGER,
    latency_ms     INTEGER,
    next_retry_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The worker's poll: pending attempts that are due.
CREATE INDEX IF NOT EXISTS idx_attempts_due
    ON delivery_attempts (next_retry_at)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_attempts_event ON delivery_attempts (event_id);
CREATE INDEX IF NOT EXISTS idx_attempts_status ON delivery_attempts (status);
CREATE INDEX IF NOT EXISTS idx_attempts_created ON delivery_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_created ON events (created_at DESC);
