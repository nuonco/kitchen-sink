package introspection

import (
	"context"
	"fmt"

	"github.com/gin-gonic/gin"
	"helm.sh/helm/v3/pkg/action"
	"helm.sh/helm/v3/pkg/chart"
	"helm.sh/helm/v3/pkg/release"
)

const HelmDescription = "Returns details about the helm charts installed, and their values."

func (s *svc) GetHelmHandler(ctx *gin.Context) {
	resp, err := s.getHelmHandler(ctx)
	if err != nil {
		s.writeErrResponse(ctx, ErrResponse{
			Description: HelmDescription,
			Err:         err,
		})
		return
	}

	s.writeOKResponse(ctx, OKResponse{
		Description: HelmDescription,
		Response:    resp,
	})
}

type helmChartResponse struct {
	Name          string            `json:"name,omitempty"`
	Info          *release.Info     `json:"info,omitempty"`
	ChartMetadata *chart.Metadata   `json:"chart_metadata,omitempty"`
	Hooks         []*release.Hook   `json:"hooks,omitempty"`
	Version       int               `json:"version,omitempty"`
	Namespace     string            `json:"namespace,omitempty"`
	Labels        map[string]string `json:"-"`
}

type helmResponse struct {
	Charts map[string]*helmChartResponse
}

func (s *svc) getHelmHandler(ctx context.Context) (*helmResponse, error) {
	resp := &helmResponse{
		Charts: make(map[string]*helmChartResponse, 0),
	}

	helmCfg, err := s.getHelmCfg(ctx, "")
	if err != nil {
		return nil, fmt.Errorf("unable to get helm config: %w", err)
	}

	client := action.NewList(helmCfg)
	client.All = true
	client.AllNamespaces = true

	listResp, err := client.Run()
	if err != nil {
		return nil, fmt.Errorf("unable to get list response: %w", err)
	}
	for _, rel := range listResp {
		k := fmt.Sprintf("%s.%s", rel.Namespace, rel.Name)
		resp.Charts[k] = &helmChartResponse{
			Name:          rel.Name,
			Info:          rel.Info,
			ChartMetadata: rel.Chart.Metadata,
			Hooks:         rel.Hooks,
			Version:       rel.Version,
			Namespace:     rel.Namespace,
			Labels:        rel.Labels,
		}
	}

	return resp, nil
}
