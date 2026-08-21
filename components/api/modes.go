package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"time"

	"go.uber.org/zap"
)

// runEcho is RELAY_MODE=echo: the in-cluster echo receiver that ships in the
// chart as relay-echo — the pre-registered default destination. It accepts
// POST /webhook, logs what arrived, and echoes the payload back with a 200,
// so every delivery the worker makes to it is a real, observable HTTP
// round-trip.
func runEcho(l *zap.Logger) {
	addr := os.Getenv("ECHO_ADDR")
	if addr == "" {
		addr = ":8081"
	}

	mux := http.NewServeMux()
	ok := func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}
	mux.HandleFunc("/livez", ok)
	mux.HandleFunc("/readyz", ok)
	mux.HandleFunc("/webhook", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		l.Info("webhook received",
			zap.String("event_id", r.Header.Get("X-Relay-Event-Id")),
			zap.String("event_type", r.Header.Get("X-Relay-Event-Type")),
			zap.String("attempt", r.Header.Get("X-Relay-Attempt")),
			zap.Int("bytes", len(body)))

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		echo := json.RawMessage(body)
		if !json.Valid(body) {
			echo = nil
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"received": true,
			"echo":     echo,
		})
	})

	l.Info("echo receiver listening", zap.String("addr", addr))
	if err := http.ListenAndServe(addr, mux); err != nil {
		l.Fatal("echo receiver failed", zap.Error(err))
	}
}

// generatorCatalog is the demo traffic the relay-event-generator CronJob
// produces every couple of minutes. The events are generated, and honestly
// labeled as such (source: relay-event-generator) — but everything after
// /ingest is the real pipeline: Postgres queue, worker HTTP POST, echo
// receiver, retries if anything is down.
var generatorCatalog = []struct {
	typ     string
	payload func(r *rand.Rand) map[string]any
}{
	{"invoice.created", func(r *rand.Rand) map[string]any {
		return map[string]any{
			"invoice_id":   fmt.Sprintf("in_%05d", r.Intn(100000)),
			"amount_cents": (r.Intn(4900) + 100) * 10,
			"currency":     "usd",
		}
	}},
	{"user.signup", func(r *rand.Rand) map[string]any {
		plans := []string{"starter", "team", "enterprise"}
		return map[string]any{
			"user_id": fmt.Sprintf("usr_%05d", r.Intn(100000)),
			"plan":    plans[r.Intn(len(plans))],
		}
	}},
	{"payment.succeeded", func(r *rand.Rand) map[string]any {
		return map[string]any{
			"charge_id":    fmt.Sprintf("ch_%05d", r.Intn(100000)),
			"amount_cents": (r.Intn(990) + 10) * 100,
			"currency":     "usd",
		}
	}},
	{"subscription.updated", func(r *rand.Rand) map[string]any {
		return map[string]any{
			"subscription_id": fmt.Sprintf("sub_%05d", r.Intn(100000)),
			"from_plan":       "starter",
			"to_plan":         "team",
		}
	}},
	{"build.completed", func(r *rand.Rand) map[string]any {
		results := []string{"passed", "passed", "passed", "failed"}
		return map[string]any{
			"build_id":         fmt.Sprintf("bld_%05d", r.Intn(100000)),
			"duration_seconds": r.Intn(600) + 20,
			"result":           results[r.Intn(len(results))],
		}
	}},
	{"deploy.finished", func(r *rand.Rand) map[string]any {
		return map[string]any{
			"deploy_id":   fmt.Sprintf("dep_%05d", r.Intn(100000)),
			"environment": "production",
			"version":     fmt.Sprintf("v1.%d.%d", r.Intn(60), r.Intn(10)),
		}
	}},
}

// runGenerate is RELAY_MODE=generate: the one-shot event generator the
// relay-event-generator CronJob runs. It POSTs 1-3 varied events to the
// ingest API and exits — zero if at least one was accepted, non-zero
// otherwise so a broken pipeline shows up as failed Jobs, not green ones.
func runGenerate(l *zap.Logger) {
	ingestURL := os.Getenv("RELAY_INGEST_URL")
	if ingestURL == "" {
		ingestURL = "http://relay-api:8080/ingest"
	}

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	client := &http.Client{Timeout: 10 * time.Second}
	n := 1 + r.Intn(3)
	accepted := 0

	for i := 0; i < n; i++ {
		entry := generatorCatalog[r.Intn(len(generatorCatalog))]
		payload := entry.payload(r)
		payload["source"] = "relay-event-generator"

		body, err := json.Marshal(map[string]any{"type": entry.typ, "payload": payload})
		if err != nil {
			l.Error("marshal event", zap.Error(err))
			continue
		}
		resp, err := client.Post(ingestURL, "application/json", bytes.NewReader(body))
		if err != nil {
			l.Error("ingest failed", zap.String("type", entry.typ), zap.Error(err))
			continue
		}
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		resp.Body.Close()
		if resp.StatusCode == http.StatusAccepted {
			accepted++
			l.Info("event ingested", zap.String("type", entry.typ), zap.String("response", string(respBody)))
		} else {
			l.Error("ingest rejected", zap.String("type", entry.typ),
				zap.Int("status", resp.StatusCode), zap.String("response", string(respBody)))
		}
	}

	l.Info("generator finished", zap.Int("sent", n), zap.Int("accepted", accepted))
	if accepted == 0 {
		os.Exit(1)
	}
}
