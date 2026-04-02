{{- define "kitchen-sink.ui.labels" -}}
app.kubernetes.io/name: {{ include "kitchen-sink.ui.name" . }}
app.kubernetes.io/component: ui
{{- include "kitchen-sink.labels" . }}
{{- end }}
