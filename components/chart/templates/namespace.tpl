apiVersion: v1
kind: Namespace
metadata:
  name: {{ .Values.namespace }}
  labels:
    {{- include "kitchen-sink.labels" . | nindent 4 }}
