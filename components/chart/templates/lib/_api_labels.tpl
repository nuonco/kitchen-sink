{{- define "periscope.api.labels" -}}
app.kubernetes.io/name: {{ include "periscope.api.name" . }}
app.kubernetes.io/component: api
{{ include "periscope.labels" . }}
{{- end }}
