package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const secretValue = "aHVudGVyMi1kby1ub3QtcHVibGlzaA=="

// namespaceResponse mirrors the shape of GET /introspect/namespace/:namespace,
// which returns whole Kubernetes objects: Secrets with their values, and pod
// specs with their container environments.
func namespaceResponse() string {
	return `{
	  "description": "Returns details about a namespace",
	  "response": {
	    "name": "periscope",
	    "secrets_count": 1,
	    "secrets": [
	      {
	        "metadata": {"name": "db-password"},
	        "type": "Opaque",
	        "data": {"db_password": "` + secretValue + `"}
	      }
	    ],
	    "pods_count": 1,
	    "pods": [
	      {
	        "metadata": {"name": "periscope-api-7c9f4d8b6-x2ptn"},
	        "spec": {
	          "containers": [
	            {
	              "name": "api",
	              "image": "example/api:v1",
	              "env": [
	                {"name": "API_URL", "value": "http://periscope-api:8080"},
	                {"name": "DB_PASSWORD", "value": "hunter2"}
	              ]
	            }
	          ],
	          "tolerations": [
	            {"key": "node.kubernetes.io/not-ready", "value": "", "effect": "NoExecute"}
	          ]
	        },
	        "status": {"phase": "Running"}
	      }
	    ]
	  }
	}`
}

func filterThrough(t *testing.T, policy apiPolicy, path, body string) map[string]any {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, path, nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(body)),
		Request:    req,
	}

	if err := policy.modifyResponse(resp); err != nil {
		t.Fatalf("modifyResponse(%s) returned an error: %s", path, err)
	}

	filtered, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("unable to read the filtered body: %s", err)
	}

	if bytes.Contains(filtered, []byte(secretValue)) {
		t.Errorf("the filtered response still contains the secret value:\n%s", filtered)
	}

	var payload map[string]any
	if err := json.Unmarshal(filtered, &payload); err != nil {
		t.Fatalf("the filtered body is not valid json: %s", err)
	}
	return payload
}

func TestNamespaceResponseIsRedacted(t *testing.T) {
	policy := newAPIPolicy("periscope")
	payload := filterThrough(t, policy, "/introspect/namespace/periscope", namespaceResponse())

	response := payload["response"].(map[string]any)

	secret := response["secrets"].([]any)[0].(map[string]any)
	data := secret["data"].(map[string]any)
	if got := data["db_password"]; got != redactedValue {
		t.Errorf("secret value: got %q, want %q", got, redactedValue)
	}
	// The key name and the metadata have to survive -- the UI lists them.
	if name := secret["metadata"].(map[string]any)["name"]; name != "db-password" {
		t.Errorf("secret name: got %q, want db-password", name)
	}

	pod := response["pods"].([]any)[0].(map[string]any)
	container := pod["spec"].(map[string]any)["containers"].([]any)[0].(map[string]any)
	env := container["env"].([]any)

	if got := env[0].(map[string]any)["value"]; got != "http://periscope-api:8080" {
		t.Errorf("API_URL was redacted but is not sensitive: got %q", got)
	}
	if got := env[1].(map[string]any)["value"]; got != redactedValue {
		t.Errorf("DB_PASSWORD value: got %q, want %q", got, redactedValue)
	}

	// Tolerations use key/value, not name/value, and must be left alone.
	toleration := pod["spec"].(map[string]any)["tolerations"].([]any)[0].(map[string]any)
	if got := toleration["value"]; got != "" {
		t.Errorf("toleration value was rewritten: got %q", got)
	}
}

// eventsResponse mirrors GET /introspect/namespace/:namespace/events. The API
// returns a deliberately minimal event shape today; the extra data map on the
// last entry stands in for a future response change, to prove the walk-based
// filters still cover this path.
func eventsResponse() string {
	return `{
	  "description": "Returns recent events in a namespace, newest first",
	  "response": {
	    "name": "periscope",
	    "events_count": 2,
	    "events": [
	      {
	        "type": "Normal",
	        "reason": "Scheduled",
	        "message": "Successfully assigned periscope/periscope-api-7c9f4d8b6-x2ptn to node-1",
	        "count": 1,
	        "firstTimestamp": "2026-08-21T10:00:00Z",
	        "lastTimestamp": "2026-08-21T10:00:00Z",
	        "involvedObject": {"kind": "Pod", "name": "periscope-api-7c9f4d8b6-x2ptn"}
	      },
	      {
	        "type": "Warning",
	        "reason": "BackOff",
	        "message": "Back-off restarting failed container",
	        "count": 3,
	        "involvedObject": {"kind": "Pod", "name": "periscope-api-7c9f4d8b6-x2ptn"},
	        "data": {"token": "` + secretValue + `"},
	        "env": [{"name": "DB_PASSWORD", "value": "` + secretValue + `"}]
	      }
	    ]
	  }
	}`
}

func TestNamespaceEventsResponseIsRedacted(t *testing.T) {
	policy := newAPIPolicy("periscope")
	payload := filterThrough(t, policy, "/introspect/namespace/periscope/events", eventsResponse())

	response := payload["response"].(map[string]any)
	events := response["events"].([]any)

	// The fields the feed renders have to survive.
	first := events[0].(map[string]any)
	if got := first["reason"]; got != "Scheduled" {
		t.Errorf("reason: got %q, want Scheduled", got)
	}
	if got := first["lastTimestamp"]; got != "2026-08-21T10:00:00Z" {
		t.Errorf("lastTimestamp: got %q, want 2026-08-21T10:00:00Z", got)
	}
	if got := first["involvedObject"].(map[string]any)["name"]; got != "periscope-api-7c9f4d8b6-x2ptn" {
		t.Errorf("involvedObject name: got %q", got)
	}

	// The defensive shapes are redacted, not forwarded.
	second := events[1].(map[string]any)
	if got := second["data"].(map[string]any)["token"]; got != redactedValue {
		t.Errorf("data value: got %q, want %q", got, redactedValue)
	}
	if got := second["env"].([]any)[0].(map[string]any)["value"]; got != redactedValue {
		t.Errorf("env value: got %q, want %q", got, redactedValue)
	}
}

func TestEnvResponseRedactsSensitiveKeys(t *testing.T) {
	policy := newAPIPolicy("periscope")
	body := `{
	  "description": "Returns the entire environment of the running service.",
	  "response": {
	    "HOSTNAME": "periscope-api-7c9f4d8b6-x2ptn",
	    "KUBERNETES_SERVICE_PORT": "443",
	    "DATABASE_PASSWORD": "` + secretValue + `",
	    "SESSION_TOKEN": "abc123"
	  }
	}`

	payload := filterThrough(t, policy, "/introspect/env", body)
	response := payload["response"].(map[string]any)

	if got := response["HOSTNAME"]; got != "periscope-api-7c9f4d8b6-x2ptn" {
		t.Errorf("HOSTNAME was redacted but is not sensitive: got %q", got)
	}
	if got := response["KUBERNETES_SERVICE_PORT"]; got != "443" {
		t.Errorf("KUBERNETES_SERVICE_PORT was redacted but is not sensitive: got %q", got)
	}
	for _, key := range []string{"DATABASE_PASSWORD", "SESSION_TOKEN"} {
		if got := response[key]; got != redactedValue {
			t.Errorf("%s: got %q, want %q", key, got, redactedValue)
		}
	}
}

func TestHelmRenderedTextIsStripped(t *testing.T) {
	policy := newAPIPolicy("periscope")
	body := `{
	  "description": "Returns details about the helm charts installed, and their values.",
	  "response": {
	    "Charts": {
	      "periscope.periscope": {
	        "name": "periscope",
	        "namespace": "periscope",
	        "info": {
	          "status": "deployed",
	          "last_deployed": "2026-08-13T17:44:02Z",
	          "notes": "Your generated password is ` + secretValue + `"
	        },
	        "hooks": [{"manifest": "kind: Secret\ndata:\n  token: ` + secretValue + `"}]
	      }
	    }
	  }
	}`

	payload := filterThrough(t, policy, "/introspect/helm", body)
	chart := payload["response"].(map[string]any)["Charts"].(map[string]any)["periscope.periscope"].(map[string]any)

	if _, present := chart["hooks"]; present {
		t.Error("hooks survived the filter")
	}

	info := chart["info"].(map[string]any)
	if _, present := info["notes"]; present {
		t.Error("release notes survived the filter")
	}

	// The metadata the UI actually renders has to survive.
	if chart["name"] != "periscope" {
		t.Errorf("release name did not survive: got %q", chart["name"])
	}
	if info["status"] != "deployed" {
		t.Errorf("release status did not survive: got %q", info["status"])
	}
	if info["last_deployed"] != "2026-08-13T17:44:02Z" {
		t.Errorf("last_deployed did not survive: got %q", info["last_deployed"])
	}
}

func TestOnlyReadEndpointsAreForwarded(t *testing.T) {
	policy := newAPIPolicy("periscope")

	allowed := []string{
		"/introspect/kube",
		"/introspect/helm",
		"/introspect/env",
		"/introspect/namespace/periscope",
		"/introspect/namespace/periscope/events",
	}
	for _, path := range allowed {
		if _, ok := policy.filtersFor(path); !ok {
			t.Errorf("%s should be forwarded but is not", path)
		}
	}

	// Endpoints that return credentials, dump empty env prefixes, or that the UI
	// simply does not read.
	denied := []string{
		"/introspect/secrets",
		"/introspect/helm-values/periscope/periscope",
		"/introspect/helm-rendered/periscope/periscope",
		"/introspect/namespace/kube-system",
		"/introspect/namespace/kube-system/events",
		"/introspect/namespace/periscope/events/anything",
		"/introspect/namespace/events",
		"/introspect/nuon",
		"/introspect/terraform",
		"/livez",
		"/",
	}
	for _, path := range denied {
		if _, ok := policy.filtersFor(path); ok {
			t.Errorf("%s should not be forwarded but is", path)
		}
	}
}

// A filter that cannot parse what it was given must not let the body through.
func TestUnparseableResponseFailsClosed(t *testing.T) {
	policy := newAPIPolicy("periscope")
	req := httptest.NewRequest(http.MethodGet, "/introspect/namespace/periscope", nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{},
		Body:       io.NopCloser(strings.NewReader("not json " + secretValue)),
		Request:    req,
	}

	if err := policy.modifyResponse(resp); err == nil {
		t.Error("modifyResponse accepted a body it could not parse")
	}
}
