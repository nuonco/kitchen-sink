package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/nuonco/conduit-app/api/internal/health"
	"github.com/nuonco/conduit-app/api/internal/introspection"
	"github.com/nuonco/conduit-app/api/internal/syncengine"
	"go.uber.org/zap"
)

func main() {
	l, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("unable to create logger: %s", err)
	}

	r := gin.Default()
	v := validator.New()
	svc, err := introspection.New(v)
	if err != nil {
		log.Fatalf("unable to create introspection service: %s", err)
	}

	healthSvc, err := health.New(v)
	if err != nil {
		log.Fatalf("unable to create health service: %s", err)
	}

	// kube handlers
	r.GET("/introspect/kube", svc.GetKubeHandler)
	r.GET("/introspect/namespace/:namespace", svc.GetNamespaceHandler)
	r.GET("/introspect/namespace/:namespace/events", svc.GetNamespaceEventsHandler)
	r.GET("/introspect/helm", svc.GetHelmHandler)
	r.GET("/introspect/helm-values/:namespace/:name", svc.GetHelmValuesHandler)
	r.GET("/introspect/helm-rendered/:namespace/:name", svc.GetHelmRenderedHandler)

	r.GET("/introspect/env", svc.GetEnvHandler)
	r.GET("/introspect/terraform", svc.GetTerraformHandler)
	r.GET("/introspect/secrets", svc.GetSecretsHandler)
	r.GET("/introspect/defaults", svc.GetDefaultsHandler)
	r.GET("/introspect/sandbox", svc.GetSandboxHandler)
	r.GET("/introspect/nuon", svc.GetNuonHandler)
	r.GET("/introspect/docker-build", svc.GetDockerBuildHandler)
	r.GET("/introspect/external-image", svc.GetExternalImageHandler)

	// sync engine status (read-only; the state lives in postgres, written by
	// the worker binary from this same image)
	syncStore, err := syncengine.OpenStoreFromEnv()
	if err != nil {
		log.Fatalf("unable to open the sync store: %s", err)
	}
	syncSvc := newSyncAPI(syncStore)
	r.GET("/sync/pipelines", syncSvc.GetPipelinesHandler)
	r.GET("/sync/runs", syncSvc.GetRunsHandler)

	r.GET("/", discoverHandler)
	r.GET("/livez", healthSvc.GetLivezHandler)
	r.GET("/readyz", healthSvc.GetReadyzHandler)

	l.Info("starting server")
	r.Run() // listen and serve on 0.0.0.0:8080
}
