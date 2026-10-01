package introspection

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

const KubeNamespaceEventsDescription = "Returns recent events in a namespace, newest first"

// maxNamespaceEvents caps the response: the UI renders a feed, not an archive.
const maxNamespaceEvents = 75

func (s *svc) GetNamespaceEventsHandler(ctx *gin.Context) {
	namespace := ctx.Param("namespace")

	resp, err := s.getNamespaceEventsHandler(ctx, namespace)
	if err != nil {
		s.writeErrResponse(ctx, ErrResponse{
			Description: KubeNamespaceEventsDescription,
			Err:         err,
		})
		return
	}

	s.writeOKResponse(ctx, OKResponse{
		Description: KubeNamespaceEventsDescription,
		Response:    resp,
	})
}

func (s *svc) getNamespaceEventsHandler(ctx context.Context, namespace string) (*kubeNamespaceEventsResponse, error) {
	kubeCfg, err := s.getKubeConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("unable to get kube config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(kubeCfg)
	if err != nil {
		return nil, fmt.Errorf("unable to get kube config: %w", err)
	}

	events, err := clientset.CoreV1().Events(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("unable to get events: %w", err)
	}

	items := events.Items
	sort.SliceStable(items, func(i, j int) bool {
		return eventLastSeen(items[i]).After(eventLastSeen(items[j]))
	})
	if len(items) > maxNamespaceEvents {
		items = items[:maxNamespaceEvents]
	}

	resp := &kubeNamespaceEventsResponse{
		Name:        namespace,
		EventsCount: len(events.Items),
		Events:      make([]kubeNamespaceEvent, 0, len(items)),
	}
	for _, event := range items {
		resp.Events = append(resp.Events, kubeNamespaceEvent{
			Type:    event.Type,
			Reason:  event.Reason,
			Message: event.Message,
			Count:   eventCount(event),
			// Normalized so every entry carries when it was first and last
			// observed, whichever pair of fields the reporter filled in.
			FirstTimestamp: metav1.NewTime(eventFirstSeen(event)),
			LastTimestamp:  metav1.NewTime(eventLastSeen(event)),
			InvolvedObject: kubeNamespaceEventObject{
				Kind: event.InvolvedObject.Kind,
				Name: event.InvolvedObject.Name,
			},
		})
	}

	return resp, nil
}

// eventLastSeen returns when an event was last observed. Older reporters fill
// in lastTimestamp; newer ones (events.k8s.io shapes) leave it zero and use
// eventTime, with firstTimestamp as the final fallback.
func eventLastSeen(event corev1.Event) time.Time {
	if !event.LastTimestamp.IsZero() {
		return event.LastTimestamp.Time
	}
	if !event.EventTime.IsZero() {
		return event.EventTime.Time
	}
	return event.FirstTimestamp.Time
}

func eventFirstSeen(event corev1.Event) time.Time {
	if !event.FirstTimestamp.IsZero() {
		return event.FirstTimestamp.Time
	}
	if !event.EventTime.IsZero() {
		return event.EventTime.Time
	}
	return event.LastTimestamp.Time
}

// eventCount mirrors the fallback above: count for classic events, the series
// count for the newer shape, and 1 for a singleton that set neither.
func eventCount(event corev1.Event) int32 {
	if event.Count > 0 {
		return event.Count
	}
	if event.Series != nil && event.Series.Count > 0 {
		return event.Series.Count
	}
	return 1
}

// kubeNamespaceEvent is deliberately minimal: the UI publishes this feed
// through the /api/ proxy, so only the fields it renders are returned.
type kubeNamespaceEvent struct {
	Type           string                   `json:"type"`
	Reason         string                   `json:"reason"`
	Message        string                   `json:"message"`
	Count          int32                    `json:"count"`
	FirstTimestamp metav1.Time              `json:"firstTimestamp"`
	LastTimestamp  metav1.Time              `json:"lastTimestamp"`
	InvolvedObject kubeNamespaceEventObject `json:"involvedObject"`
}

type kubeNamespaceEventObject struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}

type kubeNamespaceEventsResponse struct {
	Name        string               `json:"name"`
	EventsCount int                  `json:"events_count"`
	Events      []kubeNamespaceEvent `json:"events"`
}
