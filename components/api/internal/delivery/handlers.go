package delivery

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"sync/atomic"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

const (
	defaultEventsLimit = 50
	maxEventsLimit     = 200
	// maxIngestBody caps an ingested event payload.
	maxIngestBody = 1 << 20
)

// Handlers exposes the delivery store over gin. The store connects in the
// background (Postgres may come up after the api pod), so every handler
// checks readiness and answers 503 until it is.
type Handlers struct {
	l     *zap.Logger
	store atomic.Pointer[Store]
}

// NewHandlers starts the background store connection and returns the handler
// set. The api keeps serving its introspection surface while the delivery
// store is still connecting.
func NewHandlers(l *zap.Logger) *Handlers {
	h := &Handlers{l: l}
	go func() {
		store, err := Open(context.Background(), ConfigFromEnv(), l)
		if err != nil {
			// Open retries until its context ends; with the background
			// context this only happens on a hard, non-transient failure.
			l.Error("delivery store unavailable", zap.Error(err))
			return
		}
		h.store.Store(store)
	}()
	return h
}

// Register mounts the delivery routes.
//
// SECURITY: POST /ingest is in-cluster only by convention — the console's
// /api proxy (components/ui/apifilter.go) must never allowlist it. The GET
// endpoints (and the DLQ replay POST) are the ones the console forwards.
func (h *Handlers) Register(r *gin.Engine) {
	r.POST("/ingest", h.Ingest)
	r.GET("/delivery/stats", h.Stats)
	r.GET("/delivery/endpoints", h.Endpoints)
	r.GET("/delivery/events", h.Events)
	r.GET("/delivery/events/:id/attempts", h.EventAttempts)
	r.GET("/delivery/dlq", h.DLQ)
	r.POST("/delivery/dlq/:id/replay", h.Replay)
}

func (h *Handlers) ready(ctx *gin.Context) *Store {
	s := h.store.Load()
	if s == nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{"err": "delivery store not ready"})
		return nil
	}
	return s
}

type ingestRequest struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

func (h *Handlers) Ingest(ctx *gin.Context) {
	s := h.ready(ctx)
	if s == nil {
		return
	}
	ctx.Request.Body = http.MaxBytesReader(ctx.Writer, ctx.Request.Body, maxIngestBody)

	var req ingestRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"err": "body must be JSON: {\"type\": ..., \"payload\": {...}}"})
		return
	}
	if req.Type == "" || len(req.Type) > 128 {
		ctx.JSON(http.StatusBadRequest, gin.H{"err": "type is required (max 128 chars)"})
		return
	}
	var obj map[string]json.RawMessage
	if err := json.Unmarshal(req.Payload, &obj); err != nil || obj == nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"err": "payload must be a JSON object"})
		return
	}

	evt, attempts, err := s.Ingest(ctx.Request.Context(), req.Type, req.Payload)
	if err != nil {
		h.fail(ctx, "ingest", err)
		return
	}
	ctx.JSON(http.StatusAccepted, gin.H{"event": evt, "attempts": attempts})
}

func (h *Handlers) Stats(ctx *gin.Context) {
	s := h.ready(ctx)
	if s == nil {
		return
	}
	stats, err := s.GetStats(ctx.Request.Context())
	if err != nil {
		h.fail(ctx, "stats", err)
		return
	}
	ctx.JSON(http.StatusOK, stats)
}

func (h *Handlers) Endpoints(ctx *gin.Context) {
	s := h.ready(ctx)
	if s == nil {
		return
	}
	endpoints, err := s.ListEndpoints(ctx.Request.Context())
	if err != nil {
		h.fail(ctx, "endpoints", err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"endpoints": endpoints})
}

func (h *Handlers) Events(ctx *gin.Context) {
	s := h.ready(ctx)
	if s == nil {
		return
	}
	limit := defaultEventsLimit
	if raw := ctx.Query("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 {
			ctx.JSON(http.StatusBadRequest, gin.H{"err": "limit must be a positive integer"})
			return
		}
		limit = min(n, maxEventsLimit)
	}
	events, err := s.ListEvents(ctx.Request.Context(), limit)
	if err != nil {
		h.fail(ctx, "events", err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"events": events})
}

func (h *Handlers) EventAttempts(ctx *gin.Context) {
	s := h.ready(ctx)
	if s == nil {
		return
	}
	evt, attempts, err := s.GetEventWithAttempts(ctx.Request.Context(), ctx.Param("id"))
	if errors.Is(err, ErrNotFound) {
		ctx.JSON(http.StatusNotFound, gin.H{"err": "event not found"})
		return
	}
	if err != nil {
		h.fail(ctx, "event attempts", err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"event": evt, "attempts": attempts})
}

func (h *Handlers) DLQ(ctx *gin.Context) {
	s := h.ready(ctx)
	if s == nil {
		return
	}
	attempts, err := s.ListDLQ(ctx.Request.Context())
	if err != nil {
		h.fail(ctx, "dlq", err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"attempts": attempts})
}

func (h *Handlers) Replay(ctx *gin.Context) {
	s := h.ready(ctx)
	if s == nil {
		return
	}
	att, err := s.Replay(ctx.Request.Context(), ctx.Param("id"))
	if errors.Is(err, ErrNotFound) {
		ctx.JSON(http.StatusNotFound, gin.H{"err": "attempt not found"})
		return
	}
	if errors.Is(err, ErrNotDead) {
		ctx.JSON(http.StatusConflict, gin.H{"err": "attempt is not dead"})
		return
	}
	if err != nil {
		h.fail(ctx, "replay", err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"replayed": true, "attempt": att})
}

func (h *Handlers) fail(ctx *gin.Context, op string, err error) {
	h.l.Error("delivery handler failed", zap.String("op", op), zap.Error(err))
	ctx.JSON(http.StatusInternalServerError, gin.H{"err": "delivery store query failed"})
}
