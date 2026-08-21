{{- define "relay.worker.labels" -}}
app.kubernetes.io/name: {{ include "relay.worker.name" . }}
app.kubernetes.io/component: worker
{{ include "relay.labels" . }}
{{- end }}
