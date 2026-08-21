// The worker binary: Conduit's sync engine. The chart runs this as the
// conduit-worker deployment (single replica -- the engine's advisory locks are
// the belt-and-braces on top of that), from the same image as /bin/api.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nuonco/conduit-app/api/internal/syncengine"
	"go.uber.org/zap"
)

func main() {
	l, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("unable to create logger: %s", err)
	}

	store, err := syncengine.OpenStoreFromEnv()
	if err != nil {
		l.Fatal("unable to open the sync store", zap.Error(err))
	}

	listenAddr := os.Getenv("HEALTH_ADDR")
	if listenAddr == "" {
		listenAddr = ":8090"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/livez", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	// Readiness is a real fact: 503 until postgres answers a ping. While the
	// database is still coming up, the pod honestly shows not-ready instead of
	// pretending.
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := store.Ping(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte("database is not reachable: " + err.Error()))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	go func() {
		l.Info("worker health server listening", zap.String("addr", listenAddr))
		if err := http.ListenAndServe(listenAddr, mux); err != nil {
			l.Fatal("worker health server failed", zap.Error(err))
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	engine := syncengine.New(store, l)
	if err := engine.Run(ctx); err != nil {
		l.Fatal("sync engine failed", zap.Error(err))
	}
	l.Info("sync engine stopped")
}
