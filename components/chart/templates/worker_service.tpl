apiVersion: v1
kind: Service
metadata:
  name: {{ include "relay.worker.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "relay.worker.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - name: health
      port: {{ .Values.worker.port }}
      targetPort: {{ .Values.worker.port }}
      protocol: TCP
  selector:
    {{- include "relay.worker.labels" . | nindent 4 }}
