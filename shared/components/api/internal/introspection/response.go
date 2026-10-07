package introspection

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nuonco/kitchen-sink-app/api/internal/telemetry"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

type OKResponse struct {
	Description string `json:"description"`
	Response    any    `json:"response"`
}

func (s *svc) writeOKResponse(ctx *gin.Context, resp OKResponse) {
	ctx.JSON(http.StatusOK, resp)
}

type ErrResponse struct {
	Description string `json:"description"`
	Err         error  `json:"-"`
	ErrString   string `json:"err"`
}

func (s *svc) writeErrResponse(ctx *gin.Context, resp ErrResponse) {
	// Handlers answer 400 on failure, which HTTP semantic conventions do not
	// count as a server error, so mark the span explicitly: a failed
	// introspection call should show up red in a trace view.
	span := trace.SpanFromContext(ctx.Request.Context())
	span.RecordError(resp.Err)
	span.SetStatus(codes.Error, resp.Description)

	s.l.Error("received handler error",
		zap.Error(resp.Err),
		zap.String("path", ctx.FullPath()),
		telemetry.Ctx(ctx.Request.Context()),
	)

	resp.ErrString = resp.Err.Error()
	ctx.JSON(http.StatusBadRequest, resp)
}
