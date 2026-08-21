{{- define "conduit.api.labels" -}}
app.kubernetes.io/name: {{ include "conduit.api.name" . }}
app.kubernetes.io/component: api
{{ include "conduit.labels" . }}
{{- end }}
