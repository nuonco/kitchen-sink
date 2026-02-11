---
apiVersion: v1
kind: Namespace
metadata:
  name: kitchen-sink
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "common.labels" . | nindent 4 }}
