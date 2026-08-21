{{- define "relay.echo.labels" -}}
app.kubernetes.io/name: {{ include "relay.echo.name" . }}
app.kubernetes.io/component: echo
{{ include "relay.labels" . }}
{{- end }}
