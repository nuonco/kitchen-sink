apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ .Values.serviceAccount }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "relay.labels" . | nindent 4 }}
