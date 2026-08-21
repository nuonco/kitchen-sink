apiVersion: v1
kind: Service
metadata:
  name: {{ include "relay.db.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "relay.db.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - port: {{ .Values.db.port }}
      targetPort: {{ .Values.db.port }}
      protocol: TCP
  selector:
    {{- include "relay.db.labels" . | nindent 4 }}
