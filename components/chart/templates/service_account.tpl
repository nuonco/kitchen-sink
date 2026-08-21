apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ .Values.serviceAccount }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "conduit.labels" . | nindent 4 }}
