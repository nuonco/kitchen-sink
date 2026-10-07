package introspection

import (
	"github.com/go-playground/validator/v10"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

type svc struct {
	v      *validator.Validate
	l      *zap.Logger
	tracer trace.Tracer
}

func New(v *validator.Validate, l *zap.Logger) (*svc, error) {
	return &svc{
		v:      v,
		l:      l,
		tracer: otel.Tracer("github.com/nuonco/kitchen-sink-app/api/introspection"),
	}, nil
}
