apiVersion: v1
kind: Service
metadata:
  name: {{ include "conduit.ui.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "conduit.ui.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - port: {{ .Values.ui.port }}
      targetPort: {{ .Values.ui.port }}
      protocol: TCP
  selector:
    {{- include "conduit.ui.labels" . | nindent 4 }}
