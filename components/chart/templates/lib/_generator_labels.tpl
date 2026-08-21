{{- define "relay.generator.labels" -}}
app.kubernetes.io/name: {{ include "relay.generator.name" . }}
app.kubernetes.io/component: generator
{{ include "relay.labels" . }}
{{- end }}
