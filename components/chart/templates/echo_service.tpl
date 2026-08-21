apiVersion: v1
kind: Service
metadata:
  name: {{ include "relay.echo.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "relay.echo.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - port: {{ .Values.echo.port }}
      targetPort: {{ .Values.echo.port }}
      protocol: TCP
  selector:
    {{- include "relay.echo.labels" . | nindent 4 }}
