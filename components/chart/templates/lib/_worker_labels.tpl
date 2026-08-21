{{- define "conduit.worker.labels" -}}
app.kubernetes.io/name: {{ include "conduit.worker.name" . }}
app.kubernetes.io/component: worker
{{ include "conduit.labels" . }}
{{- end }}
