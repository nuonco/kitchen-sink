apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ .Values.serviceAccount }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "kitchen-sink.labels" . | nindent 4 }}
