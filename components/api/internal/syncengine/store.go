package syncengine

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"net/url"
	"os"
	"time"

	"github.com/lib/pq"
)

// Store is the engine's view of postgres. It owns no schema: the DDL ships in
// the chart's initdb ConfigMap (components/chart), and this code assumes the
// pipelines and sync_runs tables it defines.
type Store struct {
	db *sql.DB
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// OpenStoreFromEnv builds the DSN from the standard PG* variables the chart
// sets (PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE) and opens a lazy pool --
// no connection is attempted until the first query or Ping. sslmode=disable is
// deliberate: the database is a ClusterIP service inside the install's own
// namespace, never on the network path this app publishes.
func OpenStoreFromEnv() (*Store, error) {
	u := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(envOr("PGUSER", "conduit"), os.Getenv("PGPASSWORD")),
		Host:     net.JoinHostPort(envOr("PGHOST", "localhost"), envOr("PGPORT", "5432")),
		Path:     "/" + envOr("PGDATABASE", "conduit"),
		RawQuery: "sslmode=disable",
	}

	db, err := sql.Open("postgres", u.String())
	if err != nil {
		return nil, fmt.Errorf("unable to open postgres: %w", err)
	}
	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)
	db.SetConnMaxIdleTime(5 * time.Minute)
	return &Store{db: db}, nil
}

// Ping reports whether the database currently answers. The worker's /readyz
// serves this, so readiness is a real fact rather than a hardcoded ok.
func (s *Store) Ping(ctx context.Context) error {
	return s.db.PingContext(ctx)
}

// ListPipelines returns every pipeline with its most recent run (any status),
// newest first by name order. Backs GET /sync/pipelines.
func (s *Store) ListPipelines(ctx context.Context) ([]Pipeline, error) {
	const q = `
		SELECT p.id, p.name, p.description, p.source_tables, p.destination_prefix,
		       p.interval_seconds, p.paused,
		       r.id, r.status, r.started_at, r.finished_at, r.rows_copied,
		       r.bytes_written, jsonb_array_length(r.objects)
		FROM pipelines p
		LEFT JOIN LATERAL (
			SELECT * FROM sync_runs
			WHERE pipeline_id = p.id
			ORDER BY started_at DESC, id DESC
			LIMIT 1
		) r ON true
		ORDER BY p.id`

	rows, err := s.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("unable to list pipelines: %w", err)
	}
	defer rows.Close()

	pipelines := make([]Pipeline, 0)
	for rows.Next() {
		var p Pipeline
		var (
			runID        sql.NullInt64
			runStatus    sql.NullString
			runStarted   sql.NullTime
			runFinished  sql.NullTime
			runRows      sql.NullInt64
			runBytes     sql.NullInt64
			runObjsCount sql.NullInt64
		)
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Description, pq.Array(&p.SourceTables),
			&p.DestinationPrefix, &p.IntervalSeconds, &p.Paused,
			&runID, &runStatus, &runStarted, &runFinished, &runRows, &runBytes, &runObjsCount,
		); err != nil {
			return nil, fmt.Errorf("unable to scan pipeline: %w", err)
		}
		if p.SourceTables == nil {
			p.SourceTables = []string{}
		}
		if runID.Valid {
			p.LastRun = &RunSummary{
				ID:           runID.Int64,
				Status:       runStatus.String,
				StartedAt:    runStarted.Time,
				RowsCopied:   runRows.Int64,
				BytesWritten: runBytes.Int64,
				ObjectsCount: int(runObjsCount.Int64),
			}
			if runFinished.Valid {
				t := runFinished.Time
				p.LastRun.FinishedAt = &t
			}
		}
		pipelines = append(pipelines, p)
	}
	return pipelines, rows.Err()
}

// ListRuns returns recent runs newest first, optionally filtered to one
// pipeline by name. Backs GET /sync/runs.
func (s *Store) ListRuns(ctx context.Context, pipeline string, limit int) ([]SyncRun, error) {
	const q = `
		SELECT r.id, p.name, r.status, r.started_at, r.finished_at,
		       r.rows_copied, r.bytes_written, r.objects, COALESCE(r.error, '')
		FROM sync_runs r
		JOIN pipelines p ON p.id = r.pipeline_id
		WHERE ($1 = '' OR p.name = $1)
		ORDER BY r.started_at DESC, r.id DESC
		LIMIT $2`

	rows, err := s.db.QueryContext(ctx, q, pipeline, limit)
	if err != nil {
		return nil, fmt.Errorf("unable to list sync runs: %w", err)
	}
	defer rows.Close()

	runs := make([]SyncRun, 0)
	for rows.Next() {
		var r SyncRun
		var finished sql.NullTime
		var objects []byte
		if err := rows.Scan(
			&r.ID, &r.Pipeline, &r.Status, &r.StartedAt, &finished,
			&r.RowsCopied, &r.BytesWritten, &objects, &r.Error,
		); err != nil {
			return nil, fmt.Errorf("unable to scan sync run: %w", err)
		}
		if finished.Valid {
			t := finished.Time
			r.FinishedAt = &t
		}
		r.Objects = []string{}
		if len(objects) > 0 {
			if err := json.Unmarshal(objects, &r.Objects); err != nil {
				return nil, fmt.Errorf("unable to decode run %d objects: %w", r.ID, err)
			}
		}
		runs = append(runs, r)
	}
	return runs, rows.Err()
}

// DuePipelines returns the unpaused pipelines whose latest run (any status)
// started more than interval_seconds ago -- or that have never run at all,
// which is why the first sync lands within seconds of the worker starting.
func (s *Store) DuePipelines(ctx context.Context) ([]Pipeline, error) {
	const q = `
		SELECT p.id, p.name, p.description, p.source_tables, p.destination_prefix,
		       p.interval_seconds, p.paused
		FROM pipelines p
		LEFT JOIN LATERAL (
			SELECT max(started_at) AS last_started FROM sync_runs WHERE pipeline_id = p.id
		) r ON true
		WHERE NOT p.paused
		  AND (r.last_started IS NULL
		       OR r.last_started <= now() - make_interval(secs => p.interval_seconds))
		ORDER BY p.id`

	rows, err := s.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("unable to list due pipelines: %w", err)
	}
	defer rows.Close()

	pipelines := make([]Pipeline, 0)
	for rows.Next() {
		var p Pipeline
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Description, pq.Array(&p.SourceTables),
			&p.DestinationPrefix, &p.IntervalSeconds, &p.Paused,
		); err != nil {
			return nil, fmt.Errorf("unable to scan due pipeline: %w", err)
		}
		pipelines = append(pipelines, p)
	}
	return pipelines, rows.Err()
}

// StartRun records that a sync began, and returns the new run's id and start
// time (both feed the object keys the run writes).
func (s *Store) StartRun(ctx context.Context, pipelineID int64) (int64, time.Time, error) {
	var id int64
	var startedAt time.Time
	err := s.db.QueryRowContext(ctx,
		`INSERT INTO sync_runs (pipeline_id, status) VALUES ($1, 'running')
		 RETURNING id, started_at`, pipelineID,
	).Scan(&id, &startedAt)
	if err != nil {
		return 0, time.Time{}, fmt.Errorf("unable to record run start: %w", err)
	}
	return id, startedAt, nil
}

// FinishRun marks a run succeeded with what it actually moved.
func (s *Store) FinishRun(ctx context.Context, runID, rowsCopied, bytesWritten int64, objects []string) error {
	if objects == nil {
		objects = []string{}
	}
	encoded, err := json.Marshal(objects)
	if err != nil {
		return fmt.Errorf("unable to encode object keys: %w", err)
	}
	_, err = s.db.ExecContext(ctx,
		`UPDATE sync_runs
		 SET status = 'succeeded', finished_at = now(),
		     rows_copied = $2, bytes_written = $3, objects = $4
		 WHERE id = $1`, runID, rowsCopied, bytesWritten, encoded)
	if err != nil {
		return fmt.Errorf("unable to record run success: %w", err)
	}
	return nil
}

// FailRun marks a run failed with the error text. A failed sync is a visible
// failed run in the history -- the designed behavior, not a crash.
func (s *Store) FailRun(ctx context.Context, runID int64, cause error) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE sync_runs
		 SET status = 'failed', finished_at = now(), error = $2
		 WHERE id = $1`, runID, cause.Error())
	if err != nil {
		return fmt.Errorf("unable to record run failure: %w", err)
	}
	return nil
}

// lockClass namespaces this app's advisory locks ("cond" as an int32), so the
// per-pipeline lock ids cannot collide with anything else using two-key locks
// in the same database.
const lockClass int32 = 0x636f6e64

// TryLockPipeline takes the session-level advisory lock for one pipeline, on a
// dedicated connection (session locks belong to a connection; taking one
// through the pool would make the unlock a lottery). ok is false when another
// worker holds it -- the singleton guarantee that makes even a rolling-update
// overlap unable to double-write a run. The returned unlock must be called
// when ok is true.
func (s *Store) TryLockPipeline(ctx context.Context, pipelineID int64) (unlock func(), ok bool, err error) {
	conn, err := s.db.Conn(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("unable to get a connection for the pipeline lock: %w", err)
	}

	var got bool
	if err := conn.QueryRowContext(ctx,
		`SELECT pg_try_advisory_lock($1, $2)`, lockClass, int32(pipelineID),
	).Scan(&got); err != nil {
		conn.Close()
		return nil, false, fmt.Errorf("unable to take the pipeline lock: %w", err)
	}
	if !got {
		conn.Close()
		return nil, false, nil
	}

	unlock = func() {
		// Detached context: the lock must be released even when the caller's
		// context is already canceled. Closing the connection releases it
		// anyway (session locks die with the session) -- the explicit unlock
		// just does it politely.
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = conn.ExecContext(ctx, `SELECT pg_advisory_unlock($1, $2)`, lockClass, int32(pipelineID))
		conn.Close()
	}
	return unlock, true, nil
}
