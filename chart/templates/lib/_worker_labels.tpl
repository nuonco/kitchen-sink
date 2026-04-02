{{- define "kitchen-sink.worker.labels" -}}
app.kubernetes.io/name: {{ include "kitchen-sink.worker.name" . }}
app.kubernetes.io/component: worker
{{- include "kitchen-sink.labels" . }}
{{- end }}
