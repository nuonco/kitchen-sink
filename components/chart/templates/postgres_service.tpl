apiVersion: v1
kind: Service
metadata:
  name: {{ include "conduit.postgres.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "conduit.postgres.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - name: postgres
      port: {{ .Values.postgres.port }}
      targetPort: {{ .Values.postgres.port }}
      protocol: TCP
  selector:
    {{- include "conduit.postgres.labels" . | nindent 4 }}
