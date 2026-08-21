{{- define "conduit.postgres.labels" -}}
app.kubernetes.io/name: {{ include "conduit.postgres.name" . }}
app.kubernetes.io/component: postgres
{{ include "conduit.labels" . }}
{{- end }}
