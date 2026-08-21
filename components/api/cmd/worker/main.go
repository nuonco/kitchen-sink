// The /bin/worker compat entrypoint: identical to running /bin/api with
// RELAY_MODE=worker. Kept so an older chart revision that still runs
// /bin/worker gets the real delivery engine, not an idle loop.
package main

import (
	"log"

	"github.com/nuonco/kitchen-sink-app/api/internal/delivery"
	"go.uber.org/zap"
)

func main() {
	l, err := zap.NewProduction()
	if err != nil {
		log.Fatalf("unable to create logger: %s", err)
	}
	delivery.RunWorker(l)
}
