package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/nuonco/kitchen-sink-app/api/internal/delivery"
	"github.com/nuonco/kitchen-sink-app/api/internal/health"
	"github.com/nuonco/kitchen-sink-app/api/internal/introspection"
	"go.uber.org/zap"
)

// One binary, four roles, selected by RELAY_MODE (see the chart's
// deployments): "api" (default) serves the ingest/delivery API plus the
// introspection surface on :8080; "worker" runs the delivery engine;
// "echo" runs the in-cluster echo receiver on :8081; "generate" is the
// CronJob's one-shot event generator.
func main() {
	l, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("unable to create logger: %s", err)
	}

	switch mode := os.Getenv("RELAY_MODE"); mode {
	case "", "api":
		runAPI(l)
	case "worker":
		delivery.RunWorker(l)
	case "echo":
		runEcho(l)
	case "generate":
		runGenerate(l)
	default:
		l.Fatal("unknown RELAY_MODE", zap.String("mode", mode))
	}
}

func runAPI(l *zap.Logger) {
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

	// delivery handlers: the product itself. The store connects in the
	// background so this server comes up (and keeps its introspection
	// surface) even while Postgres is still starting.
	deliverySvc := delivery.NewHandlers(l)
	deliverySvc.Register(r)

	r.GET("/", discoverHandler)
	r.GET("/livez", healthSvc.GetLivezHandler)
	r.GET("/readyz", healthSvc.GetReadyzHandler)

	l.Info("starting server")
	r.Run() // listen and serve on 0.0.0.0:8080
}
