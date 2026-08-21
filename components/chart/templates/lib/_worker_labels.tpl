{{- define "periscope.collector.labels" -}}
app.kubernetes.io/name: {{ include "periscope.collector.name" . }}
app.kubernetes.io/component: collector
{{ include "periscope.labels" . }}
{{- end }}
