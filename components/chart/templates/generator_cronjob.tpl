apiVersion: batch/v1
kind: CronJob
metadata:
  name: {{ include "relay.generator.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "relay.generator.labels" . | nindent 4 }}
spec:
  # Demo traffic, honestly labeled: each run POSTs 1-3 generated events to
  # /ingest, and everything after that is the real pipeline — Postgres queue,
  # worker delivery to the echo receiver, retries and the DLQ if something is
  # down.
  schedule: {{ .Values.generator.schedule | quote }}
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      backoffLimit: 1
      activeDeadlineSeconds: 120
      template:
        metadata:
          labels:
            {{- include "relay.generator.labels" . | nindent 12 }}
        spec:
          serviceAccountName: {{ .Values.serviceAccount }}
          restartPolicy: Never
          containers:
            - name: generator
              image: {{ .Values.generator.image }}
              command: ["/bin/api"]
              env:
                - name: RELAY_MODE
                  value: "generate"
                - name: RELAY_INGEST_URL
                  value: "http://{{ include "relay.api.name" . }}:{{ .Values.api.port }}/ingest"
              resources:
                {{- toYaml .Values.generator.resources | nindent 16 }}
