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
	    "name": "relay",
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
	        "metadata": {"name": "relay-api-7c9f4d8b6-x2ptn"},
	        "spec": {
	          "containers": [
	            {
	              "name": "api",
	              "image": "example/api:v1",
	              "env": [
	                {"name": "API_URL", "value": "http://relay-api:8080"},
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

func filterThrough(t *testing.T, policy apiPolicy, method, path, body string) map[string]any {
	t.Helper()

	req := httptest.NewRequest(method, path, nil)
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(body)),
		Request:    req,
	}

	if err := policy.modifyResponse(resp); err != nil {
		t.Fatalf("modifyResponse(%s %s) returned an error: %s", method, path, err)
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
	policy := newAPIPolicy("relay")
	payload := filterThrough(t, policy, http.MethodGet, "/introspect/namespace/relay", namespaceResponse())

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

	if got := env[0].(map[string]any)["value"]; got != "http://relay-api:8080" {
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
	    "name": "relay",
	    "events_count": 2,
	    "events": [
	      {
	        "type": "Normal",
	        "reason": "Scheduled",
	        "message": "Successfully assigned relay/relay-api-7c9f4d8b6-x2ptn to node-1",
	        "count": 1,
	        "firstTimestamp": "2026-08-21T10:00:00Z",
	        "lastTimestamp": "2026-08-21T10:00:00Z",
	        "involvedObject": {"kind": "Pod", "name": "relay-api-7c9f4d8b6-x2ptn"}
	      },
	      {
	        "type": "Warning",
	        "reason": "BackOff",
	        "message": "Back-off restarting failed container",
	        "count": 3,
	        "involvedObject": {"kind": "Pod", "name": "relay-api-7c9f4d8b6-x2ptn"},
	        "data": {"token": "` + secretValue + `"},
	        "env": [{"name": "DB_PASSWORD", "value": "` + secretValue + `"}]
	      }
	    ]
	  }
	}`
}

func TestNamespaceEventsResponseIsRedacted(t *testing.T) {
	policy := newAPIPolicy("relay")
	payload := filterThrough(t, policy, http.MethodGet, "/introspect/namespace/relay/events", eventsResponse())

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
	if got := first["involvedObject"].(map[string]any)["name"]; got != "relay-api-7c9f4d8b6-x2ptn" {
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
	policy := newAPIPolicy("relay")
	body := `{
	  "description": "Returns the entire environment of the running service.",
	  "response": {
	    "HOSTNAME": "relay-api-7c9f4d8b6-x2ptn",
	    "KUBERNETES_SERVICE_PORT": "443",
	    "DATABASE_PASSWORD": "` + secretValue + `",
	    "SESSION_TOKEN": "abc123"
	  }
	}`

	payload := filterThrough(t, policy, http.MethodGet, "/introspect/env", body)
	response := payload["response"].(map[string]any)

	if got := response["HOSTNAME"]; got != "relay-api-7c9f4d8b6-x2ptn" {
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
	policy := newAPIPolicy("relay")
	body := `{
	  "description": "Returns details about the helm charts installed, and their values.",
	  "response": {
	    "Charts": {
	      "relay.relay": {
	        "name": "relay",
	        "namespace": "relay",
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

	payload := filterThrough(t, policy, http.MethodGet, "/introspect/helm", body)
	chart := payload["response"].(map[string]any)["Charts"].(map[string]any)["relay.relay"].(map[string]any)

	if _, present := chart["hooks"]; present {
		t.Error("hooks survived the filter")
	}

	info := chart["info"].(map[string]any)
	if _, present := info["notes"]; present {
		t.Error("release notes survived the filter")
	}

	// The metadata the UI actually renders has to survive.
	if chart["name"] != "relay" {
		t.Errorf("release name did not survive: got %q", chart["name"])
	}
	if info["status"] != "deployed" {
		t.Errorf("release status did not survive: got %q", info["status"])
	}
	if info["last_deployed"] != "2026-08-13T17:44:02Z" {
		t.Errorf("last_deployed did not survive: got %q", info["last_deployed"])
	}
}

// deliveryEventsResponse mirrors GET /delivery/events. Payloads are arbitrary
// JSON supplied by whoever POSTed /ingest, so the fixture hides credentials in
// every shape the walks are meant to catch.
func deliveryEventsResponse() string {
	return `{
	  "events": [
	    {
	      "id": "evt_1",
	      "type": "invoice.created",
	      "payload": {
	        "invoice_id": "inv_42",
	        "amount_cents": 1900,
	        "api_token": "` + secretValue + `",
	        "customer_secret": "` + secretValue + `",
	        "nested": {"auth": {"deep": "` + secretValue + `"}}
	      },
	      "status": "delivered",
	      "created_at": "2026-08-21T10:00:00Z"
	    }
	  ]
	}`
}

func TestDeliveryEventPayloadsAreRedacted(t *testing.T) {
	policy := newAPIPolicy("relay")
	payload := filterThrough(t, policy, http.MethodGet, "/delivery/events", deliveryEventsResponse())

	event := payload["events"].([]any)[0].(map[string]any)
	// The fields the console renders have to survive.
	if got := event["type"]; got != "invoice.created" {
		t.Errorf("event type: got %q, want invoice.created", got)
	}
	if got := event["status"]; got != "delivered" {
		t.Errorf("event status: got %q, want delivered", got)
	}

	body := event["payload"].(map[string]any)
	if got := body["invoice_id"]; got != "inv_42" {
		t.Errorf("invoice_id was redacted but is not sensitive: got %q", got)
	}
	for _, key := range []string{"api_token", "customer_secret"} {
		if got := body[key]; got != redactedValue {
			t.Errorf("payload %s: got %q, want %q", key, got, redactedValue)
		}
	}
	// A sensitive key holding an object is replaced whole.
	if got := body["nested"].(map[string]any)["auth"]; got != redactedValue {
		t.Errorf("nested auth object: got %#v, want %q", got, redactedValue)
	}
}

func TestDeliveryAttemptsAndReplayAreFiltered(t *testing.T) {
	policy := newAPIPolicy("relay")
	attempts := `{
	  "event": {"id": "evt_1", "type": "user.created", "payload": {"password": "` + secretValue + `"}, "status": "dead", "created_at": "2026-08-21T10:00:00Z"},
	  "attempts": [
	    {"id": "att_1", "event_id": "evt_1", "endpoint_id": "ep_echo_default", "attempt_number": 5,
	     "status": "dead", "response_code": 503, "latency_ms": 41, "next_retry_at": null,
	     "created_at": "2026-08-21T10:00:00Z", "event_type": "user.created",
	     "endpoint_name": "relay-echo", "endpoint_url": "http://relay-echo:8081/webhook"}
	  ]
	}`
	payload := filterThrough(t, policy, http.MethodGet, "/delivery/events/evt_1/attempts", attempts)
	att := payload["attempts"].([]any)[0].(map[string]any)
	if got := att["endpoint_url"]; got != "http://relay-echo:8081/webhook" {
		t.Errorf("endpoint_url did not survive: got %q", got)
	}
	if got := payload["event"].(map[string]any)["payload"].(map[string]any)["password"]; got != redactedValue {
		t.Errorf("event payload password: got %q, want %q", got, redactedValue)
	}

	replay := `{"replayed": true, "attempt": {"id": "att_2", "attempt_number": 6, "status": "pending",
	  "payload": {"token": "` + secretValue + `"}}}`
	payload = filterThrough(t, policy, http.MethodPost, "/delivery/dlq/att_1/replay", replay)
	if got := payload["replayed"]; got != true {
		t.Errorf("replayed flag did not survive: got %v", got)
	}
}

func TestOnlyAllowlistedRequestsAreForwarded(t *testing.T) {
	policy := newAPIPolicy("relay")

	allowedGets := []string{
		"/introspect/kube",
		"/introspect/helm",
		"/introspect/env",
		"/introspect/namespace/relay",
		"/introspect/namespace/relay/events",
		"/delivery/stats",
		"/delivery/endpoints",
		"/delivery/events",
		"/delivery/events/evt_abc123/attempts",
		"/delivery/dlq",
	}
	for _, path := range allowedGets {
		if _, ok := policy.filtersFor(http.MethodGet, path); !ok {
			t.Errorf("GET %s should be forwarded but is not", path)
		}
	}

	if _, ok := policy.filtersFor(http.MethodPost, "/delivery/dlq/att_123/replay"); !ok {
		t.Error("POST /delivery/dlq/{id}/replay should be forwarded but is not")
	}

	// Endpoints that return credentials, dump empty env prefixes, accept
	// writes, or that the UI simply does not read.
	deniedGets := []string{
		"/introspect/secrets",
		"/introspect/helm-values/relay/relay",
		"/introspect/helm-rendered/relay/relay",
		"/introspect/namespace/kube-system",
		"/introspect/namespace/kube-system/events",
		"/introspect/namespace/relay/events/anything",
		"/introspect/namespace/events",
		"/introspect/nuon",
		"/introspect/terraform",
		"/ingest",
		"/delivery",
		"/delivery/dlq/att_123/replay", // the replay is POST-only
		"/delivery/events/evt_1/attempts/extra",
		"/delivery/events/../secrets/attempts",
		"/livez",
		"/",
	}
	for _, path := range deniedGets {
		if _, ok := policy.filtersFor(http.MethodGet, path); ok {
			t.Errorf("GET %s should not be forwarded but is", path)
		}
	}

	// POST /ingest is the delivery pipeline's in-cluster front door: an
	// unauthenticated public write. It must never be forwarded, and neither
	// may any other write besides the replay.
	deniedPosts := []string{
		"/ingest",
		"/delivery/events",
		"/delivery/stats",
		"/delivery/dlq",
		"/delivery/dlq//replay",
		"/delivery/dlq/att_1/replay/extra",
		"/introspect/kube",
		"/introspect/namespace/relay",
	}
	for _, path := range deniedPosts {
		if _, ok := policy.filtersFor(http.MethodPost, path); ok {
			t.Errorf("POST %s should not be forwarded but is", path)
		}
	}

	for _, method := range []string{http.MethodPut, http.MethodDelete, http.MethodPatch} {
		if _, ok := policy.filtersFor(method, "/delivery/dlq/att_123/replay"); ok {
			t.Errorf("%s on the replay path should not be forwarded but is", method)
		}
	}
}

// A filter that cannot parse what it was given must not let the body through.
func TestUnparseableResponseFailsClosed(t *testing.T) {
	policy := newAPIPolicy("relay")
	req := httptest.NewRequest(http.MethodGet, "/introspect/namespace/relay", nil)
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
