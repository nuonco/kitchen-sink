apiVersion: v1
kind: Service
metadata:
  name: {{ include "periscope.web.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "periscope.web.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - port: {{ .Values.ui.port }}
      targetPort: {{ .Values.ui.port }}
      protocol: TCP
  selector:
    {{- include "periscope.web.labels" . | nindent 4 }}
