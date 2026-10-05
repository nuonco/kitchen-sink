package telemetry

import (
	"context"

	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Ctx is the field to pass a request context to a log call. The OTel core uses
// it to correlate the log record with the active span; the stdout core gets
// trace_id/span_id fields in its place.
func Ctx(ctx context.Context) zap.Field {
	return zap.Any("ctx", ctx)
}

// traceFieldsCore replaces context.Context fields with trace_id/span_id, so
// the JSON encoder never tries to serialize a context and stdout lines still
// carry the IDs needed to jump from a log line to its trace.
type traceFieldsCore struct {
	zapcore.Core
}

func withTraceFields(c zapcore.Core) zapcore.Core {
	return &traceFieldsCore{Core: c}
}

func (c *traceFieldsCore) With(fields []zapcore.Field) zapcore.Core {
	return &traceFieldsCore{Core: c.Core.With(replaceContextFields(fields))}
}

func (c *traceFieldsCore) Check(ent zapcore.Entry, ce *zapcore.CheckedEntry) *zapcore.CheckedEntry {
	if c.Enabled(ent.Level) {
		return ce.AddCore(ent, c)
	}
	return ce
}

func (c *traceFieldsCore) Write(ent zapcore.Entry, fields []zapcore.Field) error {
	return c.Core.Write(ent, replaceContextFields(fields))
}

func replaceContextFields(fields []zapcore.Field) []zapcore.Field {
	out := make([]zapcore.Field, 0, len(fields)+1)
	for _, f := range fields {
		ctx, ok := f.Interface.(context.Context)
		if !ok {
			out = append(out, f)
			continue
		}
		if sc := trace.SpanContextFromContext(ctx); sc.IsValid() {
			out = append(out,
				zap.String("trace_id", sc.TraceID().String()),
				zap.String("span_id", sc.SpanID().String()),
			)
		}
	}
	return out
}
