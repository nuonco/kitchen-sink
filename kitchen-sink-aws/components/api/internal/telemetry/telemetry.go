// Package telemetry wires the OpenTelemetry SDK for the api and worker
// binaries: traces, metrics and logs over OTLP/HTTP to the in-cluster
// collector (the otel_collector component), which forwards to the install's
// private telemetry endpoint.
//
// Everything is configured through the standard OTEL_* environment variables
// the chart sets. Without OTEL_EXPORTER_OTLP_ENDPOINT (local dev, or an install
// with telemetry turned off in the chart) Setup is a no-op and the binaries run
// exactly as they did before instrumentation.
package telemetry

import (
	"context"
	"errors"
	"os"
	"sync"
	"time"

	"go.opentelemetry.io/contrib/bridges/otelzap"
	"go.opentelemetry.io/contrib/instrumentation/runtime"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// metricInterval is shorter than the SDK's 60s default so a demo shows a
// change within seconds rather than a minute.
const metricInterval = 15 * time.Second

// Enabled reports whether an OTLP endpoint is configured.
func Enabled() bool {
	return os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT") != ""
}

// Setup installs global tracer, meter and logger providers and returns a
// logger that also emits every record as an OTel log (correlated with the
// active span when a context.Context is passed as a zap field), plus a
// shutdown func that flushes everything.
func Setup(ctx context.Context, serviceName string, l *zap.Logger) (*zap.Logger, func(context.Context) error, error) {
	noop := func(context.Context) error { return nil }
	stdout := l.WithOptions(zap.WrapCore(withTraceFields))
	if !Enabled() {
		stdout.Info("telemetry disabled: OTEL_EXPORTER_OTLP_ENDPOINT is not set")
		return stdout, noop, nil
	}

	// Later options win: the service name here is only a default that
	// OTEL_SERVICE_NAME / OTEL_RESOURCE_ATTRIBUTES from the chart override.
	res, err := resource.New(ctx,
		resource.WithAttributes(semconv.ServiceName(serviceName)),
		resource.WithTelemetrySDK(),
		resource.WithHost(),
		resource.WithProcessRuntimeName(),
		resource.WithProcessRuntimeVersion(),
		resource.WithFromEnv(),
	)
	if err != nil && !errors.Is(err, resource.ErrPartialResource) {
		return stdout, noop, err
	}

	traceExp, err := otlptracehttp.New(ctx)
	if err != nil {
		return stdout, noop, err
	}
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(traceExp),
		sdktrace.WithResource(res),
	)

	metricExp, err := otlpmetrichttp.New(ctx)
	if err != nil {
		return stdout, noop, err
	}
	mp := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(sdkmetric.NewPeriodicReader(metricExp, sdkmetric.WithInterval(metricInterval))),
		sdkmetric.WithResource(res),
	)

	logExp, err := otlploghttp.New(ctx)
	if err != nil {
		return stdout, noop, err
	}
	lp := sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logExp)),
		sdklog.WithResource(res),
	)

	otel.SetTracerProvider(tp)
	otel.SetMeterProvider(mp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{}, propagation.Baggage{},
	))
	otel.SetErrorHandler(newThrottledErrorHandler(l, time.Minute))

	if err := runtime.Start(); err != nil {
		l.Warn("unable to start runtime metrics", zap.Error(err))
	}

	otelCore := otelzap.NewCore(serviceName, otelzap.WithLoggerProvider(lp))
	logger := stdout.WithOptions(zap.WrapCore(func(c zapcore.Core) zapcore.Core {
		return zapcore.NewTee(c, otelCore)
	}))

	shutdown := func(ctx context.Context) error {
		return errors.Join(tp.Shutdown(ctx), mp.Shutdown(ctx), lp.Shutdown(ctx))
	}

	logger.Info("telemetry enabled",
		zap.String("endpoint", os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")),
		zap.String("service", serviceName),
	)
	return logger, shutdown, nil
}

// throttledErrorHandler keeps export failures visible without flooding stdout
// when the collector is unreachable (e.g. its component is toggled off): the
// log batcher alone would otherwise report a failure every second.
type throttledErrorHandler struct {
	l        *zap.Logger
	interval time.Duration

	mu      sync.Mutex
	last    time.Time
	dropped int
}

func newThrottledErrorHandler(l *zap.Logger, interval time.Duration) *throttledErrorHandler {
	return &throttledErrorHandler{l: l, interval: interval}
}

func (h *throttledErrorHandler) Handle(err error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if time.Since(h.last) < h.interval {
		h.dropped++
		return
	}
	h.l.Warn("telemetry export error", zap.Error(err), zap.Int("suppressed", h.dropped))
	h.last = time.Now()
	h.dropped = 0
}
