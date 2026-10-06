package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"go.uber.org/zap"
)

func main() {
	l, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("unable to create logger: %s", err)
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

	for {
		l.Info("worker")
		time.Sleep(time.Second * 5)
	}
}
