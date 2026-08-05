apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ .Values.namespace }}-config
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "kitchen-sink.labels" . | nindent 4 }}
  annotations:
    # Changes every release, so a redeploy is never a noop plan (which
    # auto-skip-noop would skip, bypassing the verify-health gate). Lives on
    # the ConfigMap because its health is "not applicable" -- no pods roll and
    # nothing has to re-stabilize just to defeat the noop check.
    nuon.co/roll: {{ .Release.Revision | quote }}
data:
  API_PORT: "{{ .Values.api.port }}"
  UI_PORT: "{{ .Values.ui.port }}"
