apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ .Values.serviceAccount }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "periscope.labels" . | nindent 4 }}
