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
	    "name": "conduit",
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
	        "metadata": {"name": "conduit-api-7c9f4d8b6-x2ptn"},
	        "spec": {
	          "containers": [
	            {
	              "name": "api",
	              "image": "example/api:v1",
	              "env": [
	                {"name": "API_URL", "value": "http://conduit-api:8080"},
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
	policy := newAPIPolicy("conduit")
	payload := filterThrough(t, policy, "/introspect/namespace/conduit", namespaceResponse())

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

	if got := env[0].(map[string]any)["value"]; got != "http://conduit-api:8080" {
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
	    "name": "conduit",
	    "events_count": 2,
	    "events": [
	      {
	        "type": "Normal",
	        "reason": "Scheduled",
	        "message": "Successfully assigned conduit/conduit-api-7c9f4d8b6-x2ptn to node-1",
	        "count": 1,
	        "firstTimestamp": "2026-08-21T10:00:00Z",
	        "lastTimestamp": "2026-08-21T10:00:00Z",
	        "involvedObject": {"kind": "Pod", "name": "conduit-api-7c9f4d8b6-x2ptn"}
	      },
	      {
	        "type": "Warning",
	        "reason": "BackOff",
	        "message": "Back-off restarting failed container",
	        "count": 3,
	        "involvedObject": {"kind": "Pod", "name": "conduit-api-7c9f4d8b6-x2ptn"},
	        "data": {"token": "` + secretValue + `"},
	        "env": [{"name": "DB_PASSWORD", "value": "` + secretValue + `"}]
	      }
	    ]
	  }
	}`
}

func TestNamespaceEventsResponseIsRedacted(t *testing.T) {
	policy := newAPIPolicy("conduit")
	payload := filterThrough(t, policy, "/introspect/namespace/conduit/events", eventsResponse())

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
	if got := first["involvedObject"].(map[string]any)["name"]; got != "conduit-api-7c9f4d8b6-x2ptn" {
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

// syncRunsResponse mirrors GET /sync/runs. Runs carry no credentials by
// design -- object keys, counts, timestamps, an error string -- but the last
// entry is poisoned with a name/value pair and a data map to prove the
// defensive walks cover this path too, exactly like the events precedent.
func syncRunsResponse() string {
	return `{
	  "description": "Returns recent sync runs, newest first.",
	  "response": {
	    "runs": [
	      {
	        "id": 42,
	        "pipeline": "orders",
	        "status": "succeeded",
	        "started_at": "2026-08-21T17:05:00Z",
	        "finished_at": "2026-08-21T17:05:02Z",
	        "rows_copied": 85,
	        "bytes_written": 12345,
	        "objects": ["orders/orders/2026-08-21T17:05:00Z-run42.csv"],
	        "error": ""
	      },
	      {
	        "id": 41,
	        "pipeline": "events",
	        "status": "failed",
	        "started_at": "2026-08-21T17:00:00Z",
	        "finished_at": "2026-08-21T17:00:01Z",
	        "rows_copied": 0,
	        "bytes_written": 0,
	        "objects": [],
	        "error": "unable to write s3://conduit-inst123/events/: AccessDenied",
	        "env": [{"name": "PGPASSWORD", "value": "` + secretValue + `"}],
	        "data": {"token": "` + secretValue + `"}
	      }
	    ]
	  }
	}`
}

func TestSyncRunsResponseIsRedacted(t *testing.T) {
	policy := newAPIPolicy("conduit")
	payload := filterThrough(t, policy, "/sync/runs", syncRunsResponse())

	response := payload["response"].(map[string]any)
	runs := response["runs"].([]any)

	// Everything the UI renders has to survive: keys, counts, error text.
	first := runs[0].(map[string]any)
	if got := first["objects"].([]any)[0]; got != "orders/orders/2026-08-21T17:05:00Z-run42.csv" {
		t.Errorf("object key did not survive: got %q", got)
	}
	if got := first["rows_copied"]; got != float64(85) {
		t.Errorf("rows_copied: got %v, want 85", got)
	}

	second := runs[1].(map[string]any)
	if got := second["error"]; got != "unable to write s3://conduit-inst123/events/: AccessDenied" {
		t.Errorf("error text did not survive: got %q", got)
	}

	// The poisoned shapes are redacted, not forwarded.
	if got := second["env"].([]any)[0].(map[string]any)["value"]; got != redactedValue {
		t.Errorf("env value: got %q, want %q", got, redactedValue)
	}
	if got := second["data"].(map[string]any)["token"]; got != redactedValue {
		t.Errorf("data value: got %q, want %q", got, redactedValue)
	}
}

func TestEnvResponseRedactsSensitiveKeys(t *testing.T) {
	policy := newAPIPolicy("conduit")
	body := `{
	  "description": "Returns the entire environment of the running service.",
	  "response": {
	    "HOSTNAME": "conduit-api-7c9f4d8b6-x2ptn",
	    "KUBERNETES_SERVICE_PORT": "443",
	    "DATABASE_PASSWORD": "` + secretValue + `",
	    "PGPASSWORD": "` + secretValue + `",
	    "SESSION_TOKEN": "abc123"
	  }
	}`

	payload := filterThrough(t, policy, "/introspect/env", body)
	response := payload["response"].(map[string]any)

	if got := response["HOSTNAME"]; got != "conduit-api-7c9f4d8b6-x2ptn" {
		t.Errorf("HOSTNAME was redacted but is not sensitive: got %q", got)
	}
	if got := response["KUBERNETES_SERVICE_PORT"]; got != "443" {
		t.Errorf("KUBERNETES_SERVICE_PORT was redacted but is not sensitive: got %q", got)
	}
	// PGPASSWORD is the credential the chart now actually forwards to the api
	// pod (secretKeyRef db-password/db_password); the PASSWORD fragment must
	// keep catching it.
	for _, key := range []string{"DATABASE_PASSWORD", "PGPASSWORD", "SESSION_TOKEN"} {
		if got := response[key]; got != redactedValue {
			t.Errorf("%s: got %q, want %q", key, got, redactedValue)
		}
	}
}

func TestHelmRenderedTextIsStripped(t *testing.T) {
	policy := newAPIPolicy("conduit")
	body := `{
	  "description": "Returns details about the helm charts installed, and their values.",
	  "response": {
	    "Charts": {
	      "conduit.conduit": {
	        "name": "conduit",
	        "namespace": "conduit",
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
	chart := payload["response"].(map[string]any)["Charts"].(map[string]any)["conduit.conduit"].(map[string]any)

	if _, present := chart["hooks"]; present {
		t.Error("hooks survived the filter")
	}

	info := chart["info"].(map[string]any)
	if _, present := info["notes"]; present {
		t.Error("release notes survived the filter")
	}

	// The metadata the UI actually renders has to survive.
	if chart["name"] != "conduit" {
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
	policy := newAPIPolicy("conduit")

	allowed := []string{
		"/introspect/kube",
		"/introspect/helm",
		"/introspect/env",
		"/introspect/namespace/conduit",
		"/introspect/namespace/conduit/events",
		"/sync/pipelines",
		"/sync/runs",
	}
	for _, path := range allowed {
		if _, ok := policy.filtersFor(path); !ok {
			t.Errorf("%s should be forwarded but is not", path)
		}
	}

	// Endpoints that return credentials, dump empty env prefixes, or that the UI
	// simply does not read. /sync is exact-paths only: anything else under it --
	// including anything that even sounds mutating -- is denied.
	denied := []string{
		"/introspect/secrets",
		"/introspect/helm-values/conduit/conduit",
		"/introspect/helm-rendered/conduit/conduit",
		"/introspect/namespace/kube-system",
		"/introspect/namespace/kube-system/events",
		"/introspect/namespace/conduit/events/anything",
		"/introspect/namespace/events",
		"/introspect/nuon",
		"/introspect/terraform",
		"/sync",
		"/sync/",
		"/sync/pipelines/orders",
		"/sync/runs/42",
		"/sync/pause",
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
	policy := newAPIPolicy("conduit")
	req := httptest.NewRequest(http.MethodGet, "/introspect/namespace/conduit", nil)
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
