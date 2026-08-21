{{- if .Values.worker.autoscaling.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "periscope.collector.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "periscope.collector.labels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "periscope.collector.name" . }}
  minReplicas: {{ .Values.worker.autoscaling.minReplicas }}
  maxReplicas: {{ .Values.worker.autoscaling.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.worker.autoscaling.targetCPUUtilizationPercentage }}
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: {{ .Values.worker.autoscaling.targetMemoryUtilizationPercentage }}
{{- end }}
