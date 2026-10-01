package introspection

import (
	"context"
	"fmt"

	"github.com/gin-gonic/gin"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

const KubeNamespaceDescription = "Returns details about a namespace"

func (s *svc) GetNamespaceHandler(ctx *gin.Context) {
	namespace := ctx.Param("namespace")

	resp, err := s.getNamespaceHandler(ctx, namespace)
	if err != nil {
		s.writeErrResponse(ctx, ErrResponse{
			Description: KubeNamespaceDescription,
			Err:         err,
		})
		return
	}

	s.writeOKResponse(ctx, OKResponse{
		Description: KubeNamespaceDescription,
		Response:    resp,
	})
}

func (s *svc) getNamespaceHandler(ctx context.Context, namespace string) (*kubeNamespaceResponse, error) {
	kubeCfg, err := s.getKubeConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("unable to get kube config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(kubeCfg)
	if err != nil {
		return nil, fmt.Errorf("unable to get kube config: %w", err)
	}

	resp := &kubeNamespaceResponse{
		Name: namespace,
	}

	secrets, err := clientset.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("unable to get secrets: %w", err)
	}
	resp.SecretsCount = len(secrets.Items)
	resp.Secrets = redactSecretData(secrets.Items)

	services, err := clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("unable to get services: %w", err)
	}
	resp.ServicesCount = len(services.Items)
	resp.Services = services.Items

	pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("unable to get pods: %w", err)
	}
	resp.PodsCount = len(pods.Items)
	resp.Pods = pods.Items

	return resp, nil
}

// redactSecretData keeps every secret's name, type and key names but replaces
// the values. The UI proxies /api/ straight through to this service and is
// published on the install's internet-facing load balancer, so returning the
// values here would publish the install's credentials -- including the
// auto-generated db_password -- to anyone who finds the URL.
func redactSecretData(secrets []corev1.Secret) []corev1.Secret {
	out := make([]corev1.Secret, 0, len(secrets))
	for _, secret := range secrets {
		redacted := secret

		redacted.Data = make(map[string][]byte, len(secret.Data))
		for key := range secret.Data {
			redacted.Data[key] = []byte("<redacted>")
		}

		if len(secret.StringData) > 0 {
			redacted.StringData = make(map[string]string, len(secret.StringData))
			for key := range secret.StringData {
				redacted.StringData[key] = "<redacted>"
			}
		}

		out = append(out, redacted)
	}

	return out
}

type kubeNamespaceResponse struct {
	Name string `json:"name"`

	SecretsCount int             `json:"secrets_count"`
	Secrets      []corev1.Secret `json:"secrets"`

	PodsCount int          `json:"pods_count"`
	Pods      []corev1.Pod `json:"pods"`

	ServicesCount int              `json:"services_count"`
	Services      []corev1.Service `json:"services"`
}
