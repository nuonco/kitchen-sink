package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nuonco/kitchen-sink-app/api/internal/telemetry"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

const serviceName = "kitchen-sink-worker"

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

	listenAddr := envOr("HEALTH_ADDR", ":8090")

	mux := http.NewServeMux()
	mux.HandleFunc("/livez", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	go func() {
		l.Info("worker health server listening", zap.String("addr", listenAddr))
		if err := http.ListenAndServe(listenAddr, mux); err != nil {
			l.Fatal("worker health server failed", zap.Error(err))
		}
	}()

	interval, err := time.ParseDuration(envOr("JOB_INTERVAL", "3s"))
	if err != nil {
		l.Warn("invalid JOB_INTERVAL, using 3s", zap.Error(err))
		interval = 3 * time.Second
	}

	w, err := newWorkload(l,
		envOr("API_URL", "http://kitchen-sink-api:8080"),
		envOr("DEMO_PROFILE", "steady"),
	)
	if err != nil {
		l.Fatal("unable to create workload", zap.Error(err))
	}
	w.run(ctx, interval)
	l.Info("worker stopped")
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
