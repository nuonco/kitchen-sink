{{- define "relay.api.labels" -}}
app.kubernetes.io/name: {{ include "relay.api.name" . }}
app.kubernetes.io/component: api
{{ include "relay.labels" . }}
{{- end }}
