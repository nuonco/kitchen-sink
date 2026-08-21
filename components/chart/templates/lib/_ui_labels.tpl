{{- define "periscope.web.labels" -}}
app.kubernetes.io/name: {{ include "periscope.web.name" . }}
app.kubernetes.io/component: web
{{ include "periscope.labels" . }}
{{- end }}
