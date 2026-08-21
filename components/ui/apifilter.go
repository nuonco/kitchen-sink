package main

// The introspection API has no authentication and this app publishes it at
// /api/ through the install's internet-facing load balancer, so anything the
// proxy forwards is effectively public. This file is that boundary: an allowlist
// of the endpoints the UI actually reads, and a response filter that strips
// credentials out of the ones it does forward.
//
// The filter runs in the server, not the browser, because a browser-side
// redaction protects nobody -- curling /api/... directly would skip it.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

const redactedValue = "<redacted by the ui proxy>"

// maxFilterBody caps how much of an API response is buffered for filtering. A
// response bigger than this is refused rather than forwarded unfiltered.
const maxFilterBody = 32 << 20

// sensitiveNameFragments matches names whose values must not be published.
// Matching on the name and leaving it visible is deliberate: a reader can see
// that a value exists and was withheld, which is the more useful thing to show.
var sensitiveNameFragments = []string{
	"PASSWORD", "PASSWD", "SECRET", "TOKEN", "KEY",
	"CREDENTIAL", "PRIVATE", "AUTH", "SESSION", "DSN",
}

func isSensitiveName(name string) bool {
	upper := strings.ToUpper(name)
	for _, fragment := range sensitiveNameFragments {
		if strings.Contains(upper, fragment) {
			return true
		}
	}
	return false
}

// filter mutates a decoded introspection response in place.
type filter func(payload any)

// apiPolicy is the allowlist and the per-endpoint filters. Paths are the
// upstream paths, after /api has been stripped.
type apiPolicy struct {
	namespace string
}

func newAPIPolicy(namespace string) apiPolicy {
	return apiPolicy{namespace: namespace}
}

// namespacePath is the only namespace the UI reads. Restricting it stops the
// public endpoint from being used to enumerate every namespace in the cluster.
func (p apiPolicy) namespacePath() string {
	return "/introspect/namespace/" + p.namespace
}

// namespaceEventsPath is the same single namespace's event feed -- an exact
// path for the same reason.
func (p apiPolicy) namespaceEventsPath() string {
	return p.namespacePath() + "/events"
}

// filtersFor returns the filters for an allowed path, and whether the path is
// allowed at all. Endpoints the UI does not read are not forwarded: several of
// them (/introspect/secrets, /introspect/helm-values/..., and
// /introspect/helm-rendered/...) return credentials by design.
func (p apiPolicy) filtersFor(path string) ([]filter, bool) {
	switch path {
	case "/introspect/kube":
		// Namespace names and phases only.
		return nil, true
	case "/introspect/helm":
		// Release metadata only, after the rendered text is dropped.
		return []filter{stripHelmRenderedText}, true
	case "/introspect/env":
		return []filter{redactEnvValues, redactNameValuePairs}, true
	case p.namespacePath():
		return []filter{redactSecretData, redactNameValuePairs}, true
	case p.namespaceEventsPath():
		// Events carry no credentials by design, but the same walks run anyway
		// so a change to what the API returns cannot quietly open a leak.
		return []filter{redactSecretData, redactNameValuePairs}, true
	}
	return nil, false
}

// deny answers a request for an endpoint the proxy will not forward. It
// explains itself, because a visitor poking at /api/ is exactly the audience
// this app is written for.
func (p apiPolicy) deny(w http.ResponseWriter, path string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	writeJSON(w, map[string]any{
		"description": "This app does not publish that introspection endpoint.",
		"err": "The introspection API is unauthenticated and this UI is reachable " +
			"from the internet, so /api/ forwards only the endpoints the UI reads " +
			"and filters credentials out of those. Run the endpoint from inside " +
			"the cluster, or through a Nuon action, to see it unfiltered.",
		"path":      path,
		"forwarded": []string{"/introspect/kube", "/introspect/helm", "/introspect/env", p.namespacePath(), p.namespaceEventsPath()},
	})
}

// modifyResponse is the ReverseProxy hook. Returning an error here means the
// response is never written to the client: the proxy calls its ErrorHandler
// instead, so a filter that cannot do its job fails closed.
func (p apiPolicy) modifyResponse(resp *http.Response) error {
	if resp.Request == nil {
		return fmt.Errorf("api response has no request to match a filter against")
	}

	path := resp.Request.URL.Path
	filters, allowed := p.filtersFor(path)
	if !allowed {
		// Unreachable: the handler denies these before proxying. Fail closed
		// rather than assume that stays true.
		return fmt.Errorf("refusing to forward unallowlisted endpoint %q", path)
	}
	if len(filters) == 0 || resp.StatusCode != http.StatusOK {
		return nil
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxFilterBody+1))
	resp.Body.Close()
	if err != nil {
		return fmt.Errorf("unable to read api response: %w", err)
	}
	if len(body) > maxFilterBody {
		return fmt.Errorf("api response is too large to filter (over %d bytes)", maxFilterBody)
	}

	var payload any
	if err := json.Unmarshal(body, &payload); err != nil {
		return fmt.Errorf("unable to parse api response for filtering: %w", err)
	}

	for _, f := range filters {
		f(payload)
	}

	filtered, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("unable to re-encode the filtered api response: %w", err)
	}

	resp.Body = io.NopCloser(bytes.NewReader(filtered))
	resp.ContentLength = int64(len(filtered))
	resp.Header.Set("Content-Length", strconv.Itoa(len(filtered)))
	resp.Header.Del("Content-Encoding")

	return nil
}

/* ============================================================
   Filters. Each walks the whole decoded payload rather than the path where a
   value is expected, so a change to the API's response shape cannot quietly
   reopen a leak.
   ============================================================ */

// redactSecretData replaces the values of every data and stringData map in the
// payload. In a namespace response those belong to Kubernetes Secrets --
// including the db_password Nuon auto-generates and syncs in.
func redactSecretData(payload any) {
	walk(payload, func(object map[string]any) {
		for _, field := range []string{"data", "stringData"} {
			values, ok := object[field].(map[string]any)
			if !ok {
				continue
			}
			for key := range values {
				values[key] = redactedValue
			}
		}
	})
}

// redactNameValuePairs covers Kubernetes-style {"name": ..., "value": ...}
// entries, which is how container environment variables arrive inside a pod
// spec. Tolerations and labels use different keys and are left alone.
func redactNameValuePairs(payload any) {
	walk(payload, func(object map[string]any) {
		name, hasName := object["name"].(string)
		if _, hasValue := object["value"].(string); !hasName || !hasValue {
			return
		}
		if isSensitiveName(name) {
			object["value"] = redactedValue
		}
	})
}

// redactEnvValues handles the flat map /introspect/env returns. This app's chart
// forwards no credentials into the pod today, so nothing matches -- but an
// envFrom secretRef added later would otherwise publish every value in it.
func redactEnvValues(payload any) {
	envelope, ok := payload.(map[string]any)
	if !ok {
		return
	}
	response, ok := envelope["response"].(map[string]any)
	if !ok {
		return
	}
	for key := range response {
		if isSensitiveName(key) {
			response[key] = redactedValue
		}
	}
}

// stripHelmRenderedText drops the two parts of a release listing that carry
// rendered chart text: hook manifests, which can embed a Secret, and the
// release notes, which are where charts conventionally print the credentials
// they generated. The UI displays neither.
func stripHelmRenderedText(payload any) {
	walk(payload, func(object map[string]any) {
		delete(object, "hooks")
		delete(object, "notes")
	})
}

// walk applies visit to every JSON object in the tree, depth first.
func walk(node any, visit func(object map[string]any)) {
	switch value := node.(type) {
	case map[string]any:
		visit(value)
		for _, child := range value {
			walk(child, visit)
		}
	case []any:
		for _, child := range value {
			walk(child, visit)
		}
	}
}
