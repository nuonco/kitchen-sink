package introspection

import (
	"context"
	"fmt"
	"net/http"
	"path/filepath"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel/trace"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	"k8s.io/client-go/util/homedir"
)

func (s *svc) getKubeConfig(ctx context.Context) (*rest.Config, error) {
	home := filepath.Join(homedir.HomeDir(), ".kube", "config")
	kubeCfg, err := clientcmd.BuildConfigFromFlags("", home)
	if err != nil {
		kubeCfg, err = rest.InClusterConfig()
		if err != nil {
			return nil, fmt.Errorf("unable to get in cluster config: %w", err)
		}
	}

	// Every Kubernetes API call becomes a client span under the request that
	// triggered it, so a trace shows exactly which API reads an endpoint makes.
	// Calls without a parent span (helm's storage driver takes no context) are
	// skipped rather than each starting an orphan one-span trace.
	kubeCfg.Wrap(func(rt http.RoundTripper) http.RoundTripper {
		return otelhttp.NewTransport(rt,
			otelhttp.WithFilter(func(r *http.Request) bool {
				return trace.SpanContextFromContext(r.Context()).IsValid()
			}),
			otelhttp.WithSpanNameFormatter(func(_ string, r *http.Request) string {
				return "kube-apiserver " + r.Method + " " + r.URL.Path
			}),
		)
	})

	return kubeCfg, nil
}
