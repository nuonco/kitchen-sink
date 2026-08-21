apiVersion: v1
kind: Service
metadata:
  name: {{ include "periscope.collector.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "periscope.collector.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - name: health
      port: {{ .Values.worker.port }}
      targetPort: {{ .Values.worker.port }}
      protocol: TCP
  selector:
    {{- include "periscope.collector.labels" . | nindent 4 }}
