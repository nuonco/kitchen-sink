{{- define "relay.ui.labels" -}}
app.kubernetes.io/name: {{ include "relay.ui.name" . }}
app.kubernetes.io/component: ui
{{ include "relay.labels" . }}
{{- end }}
