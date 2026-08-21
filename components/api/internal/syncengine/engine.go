package syncengine

import (
	"context"
	"time"

	"go.uber.org/zap"
)

// tickInterval is how often the scheduler looks for due pipelines. Not a cron
// library: a 15s ticker plus each pipeline's interval_seconds arithmetic (in
// DuePipelines) is smaller and sufficient at this granularity.
const tickInterval = 15 * time.Second

// maxConnectBackoff caps the boot-time retry while postgres is still coming up.
const maxConnectBackoff = 30 * time.Second

// Engine is the scheduler the worker binary runs.
type Engine struct {
	store    *Store
	uploader *uploader
	log      *zap.Logger
}

func New(store *Store, log *zap.Logger) *Engine {
	return &Engine{store: store, log: log}
}

// Run blocks until ctx is canceled. It waits for the database with backoff
// (the worker's /readyz stays 503 that whole time), then ticks: every 15s it
// claims the due, unpaused pipelines and runs them sequentially. A pipeline
// with no runs is due immediately, so the first sync lands within seconds of
// worker start -- day one.
func (e *Engine) Run(ctx context.Context) error {
	backoff := time.Second
	for {
		pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		err := e.store.Ping(pingCtx)
		cancel()
		if err == nil {
			break
		}
		e.log.Warn("database is not reachable yet, retrying",
			zap.Error(err), zap.Duration("backoff", backoff))
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(backoff):
		}
		if backoff *= 2; backoff > maxConnectBackoff {
			backoff = maxConnectBackoff
		}
	}
	e.log.Info("database is reachable, starting the scheduler")

	e.uploader = newUploaderFromEnv(ctx)
	if e.uploader.initErr != nil {
		// Not fatal: every run will fail with this recorded, which keeps the
		// problem visible in the product's own run history.
		e.log.Error("AWS configuration failed; runs will record this failure",
			zap.Error(e.uploader.initErr))
	}

	e.pass(ctx)
	ticker := time.NewTicker(tickInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			e.pass(ctx)
		}
	}
}

// pass runs every currently-due pipeline, sequentially.
func (e *Engine) pass(ctx context.Context) {
	due, err := e.store.DuePipelines(ctx)
	if err != nil {
		e.log.Error("unable to list due pipelines", zap.Error(err))
		return
	}
	for _, p := range due {
		if ctx.Err() != nil {
			return
		}
		e.runPipeline(ctx, p)
	}
}

// runPipeline executes one sync run under the pipeline's advisory lock. Any
// error -- SQL, CSV, S3 -- becomes a recorded failed run; the engine logs and
// moves on to the next pipeline or tick, never retrying early and never faking
// success.
func (e *Engine) runPipeline(ctx context.Context, p Pipeline) {
	unlock, ok, err := e.store.TryLockPipeline(ctx, p.ID)
	if err != nil {
		e.log.Error("unable to lock pipeline", zap.String("pipeline", p.Name), zap.Error(err))
		return
	}
	if !ok {
		e.log.Info("pipeline is locked by another worker, skipping",
			zap.String("pipeline", p.Name))
		return
	}
	defer unlock()

	runID, startedAt, err := e.store.StartRun(ctx, p.ID)
	if err != nil {
		e.log.Error("unable to start run", zap.String("pipeline", p.Name), zap.Error(err))
		return
	}

	result, runErr := e.exportPipeline(ctx, p, runID, startedAt)

	// Recording uses a detached context so a shutdown mid-run still leaves an
	// honest failed row instead of one stuck at 'running'.
	recordCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if runErr != nil {
		e.log.Error("sync failed",
			zap.String("pipeline", p.Name), zap.Int64("run", runID), zap.Error(runErr))
		if err := e.store.FailRun(recordCtx, runID, runErr); err != nil {
			e.log.Error("unable to record run failure", zap.Int64("run", runID), zap.Error(err))
		}
		return
	}

	if err := e.store.FinishRun(recordCtx, runID, result.rows, result.bytes, result.keys); err != nil {
		e.log.Error("unable to record run success", zap.Int64("run", runID), zap.Error(err))
		return
	}
	e.log.Info("sync succeeded",
		zap.String("pipeline", p.Name),
		zap.Int64("run", runID),
		zap.Int64("rows", result.rows),
		zap.Int64("bytes", result.bytes),
		zap.Strings("objects", result.keys))
}
