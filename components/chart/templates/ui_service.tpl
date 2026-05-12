apiVersion: v1
kind: Service
metadata:
  name: {{ include "kitchen-sink.ui.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "kitchen-sink.ui.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - port: {{ .Values.ui.port }}
      targetPort: {{ .Values.ui.port }}
      protocol: TCP
  selector:
    {{- include "kitchen-sink.ui.labels" . | nindent 4 }}
