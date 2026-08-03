apiVersion: v1
kind: Service
metadata:
  name: {{ include "kitchen-sink.worker.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "kitchen-sink.worker.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - name: health
      port: {{ .Values.worker.port }}
      targetPort: {{ .Values.worker.port }}
      protocol: TCP
  selector:
    {{- include "kitchen-sink.worker.labels" . | nindent 4 }}
