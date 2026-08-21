package main

// The read-only sync status endpoints /bin/api serves. Same {description,
// response} envelope as every introspection endpoint, and deliberately no
// mutating surface: pausing pipelines happens through the pause_pipelines Nuon
// action, and the sync itself is the worker's job. Query strings only -- the
// ui proxy allowlists these two exact paths.

import (
	"fmt"
	"net/http"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/nuonco/conduit-app/api/internal/syncengine"
)

const (
	// SyncPipelinesDescription describes GET /sync/pipelines.
	SyncPipelinesDescription = "Returns every sync pipeline with its most recent run, plus the destination bucket."
	// SyncRunsDescription describes GET /sync/runs.
	SyncRunsDescription = "Returns recent sync runs, newest first. Filter with ?pipeline=<name>; ?limit=<n> caps the list (default 50, max 200)."
)

const (
	defaultRunsLimit = 50
	maxRunsLimit     = 200
)

type syncAPI struct {
	store  *syncengine.Store
	bucket string
}

func newSyncAPI(store *syncengine.Store) *syncAPI {
	return &syncAPI{
		store: store,
		// Display only: the api pod gets the bucket name, never AWS
		// credentials -- only the worker's service account can write.
		bucket: os.Getenv("S3_BUCKET"),
	}
}

func (s *syncAPI) writeErr(ctx *gin.Context, description string, err error) {
	ctx.JSON(http.StatusBadRequest, gin.H{
		"description": description,
		"err":         err.Error(),
	})
}

// GetPipelinesHandler serves GET /sync/pipelines.
func (s *syncAPI) GetPipelinesHandler(ctx *gin.Context) {
	pipelines, err := s.store.ListPipelines(ctx.Request.Context())
	if err != nil {
		s.writeErr(ctx, "Unable to list sync pipelines.", err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"description": SyncPipelinesDescription,
		"response": gin.H{
			"bucket":          s.bucket,
			"pipelines_count": len(pipelines),
			"pipelines":       pipelines,
		},
	})
}

// GetRunsHandler serves GET /sync/runs?pipeline=<name>&limit=<n>.
func (s *syncAPI) GetRunsHandler(ctx *gin.Context) {
	limit := defaultRunsLimit
	if raw := ctx.Query("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 {
			s.writeErr(ctx, "Unable to list sync runs.",
				fmt.Errorf("limit must be a positive integer, got %q", raw))
			return
		}
		limit = parsed
		if limit > maxRunsLimit {
			limit = maxRunsLimit
		}
	}

	runs, err := s.store.ListRuns(ctx.Request.Context(), ctx.Query("pipeline"), limit)
	if err != nil {
		s.writeErr(ctx, "Unable to list sync runs.", err)
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"description": SyncRunsDescription,
		"response": gin.H{
			"runs": runs,
		},
	})
}
