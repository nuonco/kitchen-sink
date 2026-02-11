---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "common.fullname" . }}-ui
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "common.uiLabels" . | nindent 4 }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "common.fullname" . }}-ui
  minReplicas: {{ .Values.ui.autoscaling.minReplicas | default 1 }}
  maxReplicas: {{ .Values.ui.autoscaling.maxReplicas | default 3 }}
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
