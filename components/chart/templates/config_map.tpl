apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ .Values.namespace }}-config
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "kitchen-sink.labels" . | nindent 4 }}
data:
  API_PORT: "{{ .Values.api.port }}"
  UI_PORT: "{{ .Values.ui.port }}"
