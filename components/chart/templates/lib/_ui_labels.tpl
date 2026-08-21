{{- define "conduit.ui.labels" -}}
app.kubernetes.io/name: {{ include "conduit.ui.name" . }}
app.kubernetes.io/component: ui
{{ include "conduit.labels" . }}
{{- end }}
