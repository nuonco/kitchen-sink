package main

import (
	"embed"
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path"
	"strings"
)

//go:embed frontend/dist
var staticFiles embed.FS

// dashboardBaseURL is where install deep links point. Overridable so a staging
// control plane can be pointed at without a rebuild.
const defaultDashboardBaseURL = "https://app.nuon.co"

// uiConfig is the runtime configuration the frontend needs and cannot discover
// from the introspection API: which install it belongs to, and how to link back
// into the Nuon dashboard.
type uiConfig struct {
	InstallID    string            `json:"install_id,omitempty"`
	OrgID        string            `json:"org_id,omitempty"`
	AppID        string            `json:"app_id,omitempty"`
	ClusterName  string            `json:"cluster_name,omitempty"`
	Region       string            `json:"region,omitempty"`
	PublicDomain string            `json:"public_domain,omitempty"`
	Namespace    string            `json:"namespace,omitempty"`
	Links        map[string]string `json:"links"`
}

// resolvedEnv reads an env var and discards values that are missing or that
// arrived as an unrendered template. A Nuon template variable that does not
// resolve renders as an empty string or "<no value>", and an app config synced
// outside of Nuon (local dev) leaves the raw "{{...}}" in place. All three mean
// "no value" -- the frontend hides any fact it did not receive.
func resolvedEnv(key string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" || v == "<no value>" || strings.Contains(v, "{{") {
		return ""
	}
	return v
}

func buildUIConfig() uiConfig {
	cfg := uiConfig{
		InstallID:    resolvedEnv("NUON_INSTALL_ID"),
		OrgID:        resolvedEnv("NUON_ORG_ID"),
		AppID:        resolvedEnv("NUON_APP_ID"),
		ClusterName:  resolvedEnv("NUON_CLUSTER_NAME"),
		Region:       resolvedEnv("NUON_REGION"),
		PublicDomain: resolvedEnv("NUON_PUBLIC_DOMAIN"),
		Namespace:    resolvedEnv("NUON_NAMESPACE"),
		Links:        map[string]string{},
	}
	if cfg.Namespace == "" {
		cfg.Namespace = "relay"
	}

	base := resolvedEnv("NUON_DASHBOARD_URL")
	if base == "" {
		base = defaultDashboardBaseURL
	}
	base = strings.TrimSuffix(base, "/")

	// Every dashboard URL needs the org and the install this app belongs to.
	// Both come from the chart's NUON_* env (never hardcoded: any prospect's
	// install runs under their own org), so without either we ship no links at
	// all rather than links that 404.
	if cfg.InstallID == "" || cfg.OrgID == "" {
		return cfg
	}

	// URL shapes verified against the dashboard's router
	// (nuonco/nuon services/dashboard-ui/client/views/{org,app,install}/routes.tsx).
	org := base + "/" + cfg.OrgID
	install := org + "/installs/" + cfg.InstallID
	cfg.Links = map[string]string{
		"install":    install,
		"components": install + "/components",
		"actions":    install + "/actions",
		"runbooks":   install + "/runbooks",
		// Deploy / provision workflow history for this install; a branch run's
		// per-install approval also lands here.
		"workflows": install + "/workflows",
		// The install's app-config version history (a fresh install starts at v1).
		"versions": install + "/versions",
		// Org-level API tokens, for anyone wiring up the CLI or an agent.
		"tokens": org + "/settings/api-tokens",
	}
	if cfg.AppID != "" {
		// App branches: the staged rollout's runs and pending approvals.
		cfg.Links["branches"] = org + "/apps/" + cfg.AppID + "/branches"
	}
	// The audit_log_exporter component's page on this install, where its
	// per-install toggle lives. The component id arrives through the chart env
	// like every other identity fact (see values.yaml for why it is
	// `.component_id`, never `.outputs.`); when it is absent the link is not
	// shipped and the frontend falls back to the components list.
	if id := resolvedEnv("NUON_AUDIT_LOG_EXPORTER_COMPONENT_ID"); id != "" {
		cfg.Links["audit_log_exporter"] = install + "/components/" + id
	}
	return cfg
}

// spaHandler serves the embedded frontend, falling back to index.html for paths
// that are not files on disk. The app itself uses hash routing, so this only
// matters for hand-typed or shared URLs.
func spaHandler(dist fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(dist))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if name == "" || name == "." {
			fileServer.ServeHTTP(w, r)
			return
		}

		if _, err := fs.Stat(dist, name); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}

		// A missing asset is a real 404 -- only unknown routes get index.html.
		if ext := path.Ext(name); ext != "" {
			http.NotFound(w, r)
			return
		}

		index, err := fs.ReadFile(dist, "index.html")
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(index)
	})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("unable to write json response: %s", err)
	}
}

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

	cfg := buildUIConfig()
	policy := newAPIPolicy(cfg.Namespace)

	proxy := httputil.NewSingleHostReverseProxy(target)
	// Strips credentials out of the responses this app publishes. Failing here
	// means the response is never written to the client.
	proxy.ModifyResponse = policy.modifyResponse
	// The introspection API is a single pod with a small memory limit; a request
	// that kills it should surface as a readable error, not a blank page. This
	// also catches a filter that could not do its job.
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("api proxy error for %s: %s", r.URL.Path, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		writeJSON(w, map[string]string{
			"description": "The introspection API could not be read.",
			"err":         err.Error(),
		})
	}

	mux := http.NewServeMux()

	// Runtime config for the frontend. Registered as a more specific pattern
	// than "/api/", so it is never proxied to the introspection API.
	mux.HandleFunc("/api/ui-config", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, cfg)
	})

	// Proxy /api/* requests to the API service
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		// Strip /api prefix before proxying
		r.URL.Path = r.URL.Path[len("/api"):]
		r.Host = target.Host

		if _, allowed := policy.filtersFor(r.Method, r.URL.Path); !allowed {
			log.Printf("api proxy denied %s", r.URL.Path)
			policy.deny(w, r.URL.Path)
			return
		}

		// The response filter has to parse what comes back, so ask the API for
		// an uncompressed body regardless of what the browser asked us for.
		r.Header.Del("Accept-Encoding")

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
	mux.Handle("/", spaHandler(distFS))

	log.Printf("starting BFF server on %s, proxying API to %s (install=%q org=%q)",
		listenAddr, apiURL, cfg.InstallID, cfg.OrgID)
	if err := http.ListenAndServe(listenAddr, mux); err != nil {
		log.Fatalf("server error: %s", err)
	}
}
