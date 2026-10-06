apiVersion: v1
kind: Service
metadata:
  name: {{ include "kitchen-sink.api.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "kitchen-sink.api.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - port: {{ .Values.api.port }}
      targetPort: {{ .Values.api.port }}
      protocol: TCP
  selector:
    {{- include "kitchen-sink.api.labels" . | nindent 4 }}
