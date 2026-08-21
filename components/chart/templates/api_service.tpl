apiVersion: v1
kind: Service
metadata:
  name: {{ include "conduit.api.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "conduit.api.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - port: {{ .Values.api.port }}
      targetPort: {{ .Values.api.port }}
      protocol: TCP
  selector:
    {{- include "conduit.api.labels" . | nindent 4 }}
