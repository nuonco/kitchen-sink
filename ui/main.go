package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
)

//go:embed frontend/dist
var staticFiles embed.FS

func main() {
	apiURL := os.Getenv("API_URL")
	if apiURL == "" {
		apiURL = "http://localhost:8080"
	}

	listenAddr := os.Getenv("LISTEN_ADDR")
	if listenAddr == "" {
		listenAddr = ":3000"
	}

	target, err := url.Parse(apiURL)
	if err != nil {
		log.Fatalf("invalid API_URL: %s", err)
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	mux := http.NewServeMux()

	// Proxy /api/* requests to the API service
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		// Strip /api prefix before proxying
		r.URL.Path = r.URL.Path[len("/api"):]
		r.Host = target.Host
		proxy.ServeHTTP(w, r)
	})

	// Health endpoints
	mux.HandleFunc("/livez", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Serve static frontend files
	distFS, err := fs.Sub(staticFiles, "frontend/dist")
	if err != nil {
		log.Fatalf("unable to create sub filesystem: %s", err)
	}
	fileServer := http.FileServer(http.FS(distFS))
	mux.Handle("/", fileServer)

	log.Printf("starting BFF server on %s, proxying API to %s", listenAddr, apiURL)
	if err := http.ListenAndServe(listenAddr, mux); err != nil {
		log.Fatalf("server error: %s", err)
	}
}
