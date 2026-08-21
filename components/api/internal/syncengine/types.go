// Package syncengine is Conduit's sync engine: a scheduled Postgres -> S3 copy
// job with a run history. Pipelines and their runs live in the install's own
// postgres (schema shipped by the chart's initdb ConfigMap); every run reads
// real rows, writes real CSV objects into the install's destination bucket, and
// records what happened -- succeeded or failed -- in sync_runs. Nothing here is
// simulated: a sync that cannot happen is a recorded failed run, not a fake
// success.
//
// The package is shared by both binaries in this image: /bin/worker runs the
// scheduler (engine.go), /bin/api serves the read-only status endpoints backed
// by the same queries (store.go).
package syncengine

import "time"

// Pipeline is a row in the pipelines table. The JSON tags are the
// /sync/pipelines response contract; ID stays internal.
type Pipeline struct {
	ID                int64       `json:"-"`
	Name              string      `json:"name"`
	Description       string      `json:"description"`
	SourceTables      []string    `json:"source_tables"`
	DestinationPrefix string      `json:"destination_prefix"`
	IntervalSeconds   int         `json:"interval_seconds"`
	Paused            bool        `json:"paused"`
	LastRun           *RunSummary `json:"last_run"`
}

// RunSummary is the compact form of a run embedded in a pipeline listing --
// enough to render "last run: succeeded, 85 rows, 2m ago" without a second
// request. FinishedAt is null while the run is still going.
type RunSummary struct {
	ID           int64      `json:"id"`
	Status       string     `json:"status"`
	StartedAt    time.Time  `json:"started_at"`
	FinishedAt   *time.Time `json:"finished_at"`
	RowsCopied   int64      `json:"rows_copied"`
	BytesWritten int64      `json:"bytes_written"`
	ObjectsCount int        `json:"objects_count"`
}

// SyncRun is a full row in the sync_runs table, as served by /sync/runs.
// Objects holds the S3 keys the run wrote; Error is "" unless the run failed.
type SyncRun struct {
	ID           int64      `json:"id"`
	Pipeline     string     `json:"pipeline"`
	Status       string     `json:"status"`
	StartedAt    time.Time  `json:"started_at"`
	FinishedAt   *time.Time `json:"finished_at"`
	RowsCopied   int64      `json:"rows_copied"`
	BytesWritten int64      `json:"bytes_written"`
	Objects      []string   `json:"objects"`
	Error        string     `json:"error"`
}
