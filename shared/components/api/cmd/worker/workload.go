package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"sync/atomic"
	"time"

	"github.com/nuonco/kitchen-sink-app/api/internal/telemetry"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

// The worker runs a synthetic background workload so every install emits
// steady, realistic telemetry without anyone clicking around: each job is a
// trace with child steps (one of which calls the api, giving a cross-service
// trace down to the Kubernetes API), plus job metrics and correlated logs.
//
// DEMO_PROFILE shapes it per install. Set through the telemetry_demo_profile
// input, so flipping one install to "incident" in Nuon makes exactly that
// install go red in the fleet's dashboards.

const (
	instrumentationName = "github.com/nuonco/kitchen-sink-app/api/worker"
	maxBacklog          = 1000
)

type profile struct {
	// errorRate is the baseline chance a job fails.
	errorRate float64
	// latency is the range of the job's processing step.
	minLatency, maxLatency time.Duration
	// degradedJob, when set, fails at degradedErrorRate and runs slow: an
	// incident looks like one broken dependency, not uniform noise.
	degradedJob       string
	degradedErrorRate float64
	degradedLatency   time.Duration
}

var profiles = map[string]profile{
	"steady": {
		errorRate:  0.02,
		minLatency: 40 * time.Millisecond,
		maxLatency: 250 * time.Millisecond,
	},
	"noisy": {
		errorRate:  0.10,
		minLatency: 80 * time.Millisecond,
		maxLatency: 900 * time.Millisecond,
	},
	"incident": {
		errorRate:         0.03,
		minLatency:        40 * time.Millisecond,
		maxLatency:        250 * time.Millisecond,
		degradedJob:       "reconcile_billing",
		degradedErrorRate: 0.6,
		degradedLatency:   2500 * time.Millisecond,
	},
}

type jobType struct {
	name string
	// apiPath is the api endpoint the job's fetch step reads.
	apiPath string
	// failures are the error messages this job can fail with.
	failures []string
}

var jobTypes = []jobType{
	{
		name:     "sync_inventory",
		apiPath:  "/introspect/kube",
		failures: []string{"inventory source returned 503", "sku catalog schema mismatch"},
	},
	{
		name:     "generate_report",
		apiPath:  "/introspect/namespace/kitchen-sink",
		failures: []string{"report template not found", "report export timed out"},
	},
	{
		name:     "reconcile_billing",
		apiPath:  "/introspect/helm",
		failures: []string{"payment provider returned 503", "ledger lock wait timeout"},
	},
	{
		name:     "send_notifications",
		apiPath:  "/introspect/namespace/kitchen-sink/events",
		failures: []string{"smtp relay refused connection", "rate limited by notification provider"},
	},
}

type workload struct {
	l           *zap.Logger
	apiURL      string
	profileName string
	profile     profile
	http        *http.Client
	tracer      trace.Tracer

	jobs     metric.Int64Counter
	duration metric.Float64Histogram
	backlog  atomic.Int64
}

func newWorkload(l *zap.Logger, apiURL, profileName string) (*workload, error) {
	p, ok := profiles[profileName]
	if !ok {
		l.Warn("unknown demo profile, using steady", zap.String("profile", profileName))
		profileName, p = "steady", profiles["steady"]
	}

	meter := otel.Meter(instrumentationName)
	w := &workload{
		l:           l,
		apiURL:      apiURL,
		profileName: profileName,
		profile:     p,
		http: &http.Client{
			Timeout:   10 * time.Second,
			Transport: otelhttp.NewTransport(http.DefaultTransport),
		},
		tracer: otel.Tracer(instrumentationName),
	}

	var err error
	w.jobs, err = meter.Int64Counter("kitchen_sink.jobs.processed",
		metric.WithDescription("Background jobs processed by the worker, by type and outcome."),
		metric.WithUnit("{job}"))
	if err != nil {
		return nil, err
	}
	w.duration, err = meter.Float64Histogram("kitchen_sink.job.duration",
		metric.WithDescription("Wall time of a background job, by type and outcome."),
		metric.WithUnit("s"),
		metric.WithExplicitBucketBoundaries(0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10))
	if err != nil {
		return nil, err
	}
	_, err = meter.Int64ObservableGauge("kitchen_sink.jobs.backlog",
		metric.WithDescription("Jobs waiting to be processed. Grows while jobs fail and drains while they succeed."),
		metric.WithUnit("{job}"),
		metric.WithInt64Callback(func(_ context.Context, o metric.Int64Observer) error {
			o.Observe(w.backlog.Load(), metric.WithAttributes(attribute.String("demo.profile", w.profileName)))
			return nil
		}))
	if err != nil {
		return nil, err
	}

	return w, nil
}

func (w *workload) run(ctx context.Context, interval time.Duration) {
	w.l.Info("synthetic workload started",
		zap.String("profile", w.profileName),
		zap.Duration("interval", interval),
		zap.String("api_url", w.apiURL),
	)

	var seq int64
	for {
		seq++
		w.runJob(ctx, seq, jobTypes[rand.IntN(len(jobTypes))])

		select {
		case <-ctx.Done():
			return
		case <-time.After(interval):
		}
	}
}

func (w *workload) runJob(ctx context.Context, seq int64, jt jobType) {
	jobID := fmt.Sprintf("job-%06d", seq)
	degraded := jt.name == w.profile.degradedJob

	ctx, span := w.tracer.Start(ctx, "job "+jt.name,
		trace.WithSpanKind(trace.SpanKindConsumer),
		trace.WithAttributes(
			attribute.String("job.id", jobID),
			attribute.String("job.type", jt.name),
			attribute.String("demo.profile", w.profileName),
			attribute.Bool("demo.degraded", degraded),
		))
	start := time.Now()

	err := w.steps(ctx, jt, degraded)

	outcome := "success"
	if err != nil {
		outcome = "failure"
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		// A failed job is retried later along with the work queued behind it,
		// so the backlog only climbs once failures cross ~15%: steady and noisy
		// hover near zero, incident visibly grows.
		if w.backlog.Load() < maxBacklog {
			w.backlog.Add(6)
		}
	} else if w.backlog.Load() > 0 {
		w.backlog.Add(-1)
	}
	span.SetAttributes(attribute.String("job.outcome", outcome))
	span.End()

	elapsed := time.Since(start)
	attrs := metric.WithAttributes(
		attribute.String("job.type", jt.name),
		attribute.String("job.outcome", outcome),
		attribute.String("demo.profile", w.profileName),
	)
	w.jobs.Add(ctx, 1, attrs)
	w.duration.Record(ctx, elapsed.Seconds(), attrs)

	fields := []zap.Field{
		zap.String("job_id", jobID),
		zap.String("job_type", jt.name),
		zap.Duration("duration", elapsed),
		telemetry.Ctx(ctx),
	}
	if err != nil {
		w.l.Error("job failed", append(fields, zap.Error(err))...)
		return
	}
	w.l.Info("job completed", fields...)
}

// steps is the job body: each step is a child span, so a trace view shows
// where the time went and which step failed.
func (w *workload) steps(ctx context.Context, jt jobType, degraded bool) error {
	if err := w.step(ctx, "validate", func(context.Context) error {
		sleepBetween(5*time.Millisecond, 20*time.Millisecond)
		return nil
	}); err != nil {
		return err
	}

	if err := w.step(ctx, "fetch", func(ctx context.Context) error {
		return w.callAPI(ctx, jt.apiPath)
	}); err != nil {
		return err
	}

	if err := w.step(ctx, "process", func(context.Context) error {
		errorRate := w.profile.errorRate
		if degraded {
			sleepBetween(w.profile.degradedLatency/2, w.profile.degradedLatency)
			errorRate = w.profile.degradedErrorRate
		} else {
			sleepBetween(w.profile.minLatency, w.profile.maxLatency)
		}
		if rand.Float64() < errorRate {
			return errors.New(jt.failures[rand.IntN(len(jt.failures))])
		}
		return nil
	}); err != nil {
		return err
	}

	return w.step(ctx, "publish", func(context.Context) error {
		sleepBetween(5*time.Millisecond, 30*time.Millisecond)
		return nil
	})
}

func (w *workload) step(ctx context.Context, name string, fn func(context.Context) error) error {
	ctx, span := w.tracer.Start(ctx, name)
	defer span.End()

	if err := fn(ctx); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}
	return nil
}

func (w *workload) callAPI(ctx context.Context, path string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, w.apiURL+path, nil)
	if err != nil {
		return err
	}
	resp, err := w.http.Do(req)
	if err != nil {
		return fmt.Errorf("api request failed: %w", err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)

	if resp.StatusCode >= 400 {
		return fmt.Errorf("api %s returned %d", path, resp.StatusCode)
	}
	return nil
}

func sleepBetween(lo, hi time.Duration) {
	if hi <= lo {
		time.Sleep(lo)
		return
	}
	time.Sleep(lo + rand.N(hi-lo))
}
