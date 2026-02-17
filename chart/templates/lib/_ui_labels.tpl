{{- define "common.uiLabels" -}}
app: {{ .Release.Name }}-ui
helm.sh/chart: {{ include "common.chart" . }}
{{ include "common.uiSelectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "common.uiSelectorLabels" -}}
app.kubernetes.io/name: {{ include "common.name" . }}-ui
app.kubernetes.io/instance: {{ .Release.Name }}-ui
{{- end }}
