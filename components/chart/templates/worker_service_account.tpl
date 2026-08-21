# Dedicated ServiceAccount for the sync engine. The eks.amazonaws.com/role-arn
# annotation (Nuon-interpolated from the destination_bucket component's
# sync_role_arn output) is the IRSA hookup: EKS injects web-identity
# credentials for that role into pods running as this SA. The api/ui pods run
# as the plain `conduit` SA and get no AWS credentials.
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ .Values.worker.serviceAccount }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "conduit.worker.labels" . | nindent 4 }}
  {{- with .Values.workerServiceAccountAnnotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
