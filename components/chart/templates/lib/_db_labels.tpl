{{- define "relay.db.labels" -}}
app.kubernetes.io/name: {{ include "relay.db.name" . }}
app.kubernetes.io/component: db
{{ include "relay.labels" . }}
{{- end }}
