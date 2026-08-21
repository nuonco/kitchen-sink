apiVersion: v1
kind: Service
metadata:
  name: {{ include "relay.ui.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "relay.ui.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - port: {{ .Values.ui.port }}
      targetPort: {{ .Values.ui.port }}
      protocol: TCP
  selector:
    {{- include "relay.ui.labels" . | nindent 4 }}
