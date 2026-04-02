{{- define "kitchen-sink.api.labels" -}}
app.kubernetes.io/name: {{ include "kitchen-sink.api.name" . }}
app.kubernetes.io/component: api
{{- include "kitchen-sink.labels" . }}
{{- end }}
