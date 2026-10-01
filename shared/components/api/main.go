package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/nuonco/kitchen-sink-app/api/internal/health"
	"github.com/nuonco/kitchen-sink-app/api/internal/introspection"
	"github.com/nuonco/kitchen-sink-app/api/internal/telemetry"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

const serviceName = "kitchen-sink-api"

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Errors here are expected, handled conditions (failed jobs, failed
	// introspection reads); a stacktrace on each one is noise.
	l, err := zap.NewProduction(zap.AddStacktrace(zapcore.DPanicLevel))
	if err != nil {
		log.Fatalf("unable to create logger: %s", err)
	}

	l, shutdownTelemetry, err := telemetry.Setup(ctx, serviceName, l)
	if err != nil {
		l.Error("unable to set up telemetry, continuing without it", zap.Error(err))
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = shutdownTelemetry(ctx)
	}()

	r := gin.Default()
	// Handlers pass *gin.Context on as a context.Context; without the fallback
	// its Value() ignores the request context, which is where otelgin puts the
	// server span, and every downstream Kubernetes call would start a new trace.
	r.ContextWithFallback = true
	r.Use(otelgin.Middleware(serviceName, otelgin.WithFilter(func(req *http.Request) bool {
		// Probes every few seconds would drown the interesting traces.
		return req.URL.Path != "/livez" && req.URL.Path != "/readyz"
	})))

	v := validator.New()
	svc, err := introspection.New(v, l)
	if err != nil {
		l.Fatal("unable to create introspection service", zap.Error(err))
	}

	healthSvc, err := health.New(v)
	if err != nil {
		l.Fatal("unable to create health service", zap.Error(err))
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

	r.GET("/", discoverHandler)
	r.GET("/livez", healthSvc.GetLivezHandler)
	r.GET("/readyz", healthSvc.GetReadyzHandler)

	// Same default as gin's r.Run(), which this replaced to allow a graceful
	// shutdown that flushes buffered telemetry.
	addr := ":8080"
	if port := os.Getenv("PORT"); port != "" {
		addr = ":" + port
	}
	srv := &http.Server{Addr: addr, Handler: r}
	go func() {
		l.Info("starting server", zap.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			l.Fatal("server error", zap.Error(err))
		}
	}()

	<-ctx.Done()
	l.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
