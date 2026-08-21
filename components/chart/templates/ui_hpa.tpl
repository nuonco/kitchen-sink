{{- if .Values.ui.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "conduit.ui.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "conduit.ui.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "conduit.ui.name" . }}
  minReplicas: {{ .Values.ui.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.ui.autoscaling.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.ui.autoscaling.targetCPUUtilizationPercentage }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ .Values.ui.autoscaling.targetMemoryUtilizationPercentage }}
{{- end }}
