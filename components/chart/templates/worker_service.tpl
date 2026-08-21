apiVersion: v1
kind: Service
metadata:
  name: {{ include "conduit.worker.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "conduit.worker.labels" . | nindent 4 }}
spec:
  type: ClusterIP
  ports:
    - name: health
      port: {{ .Values.worker.port }}
      targetPort: {{ .Values.worker.port }}
      protocol: TCP
  selector:
    {{- include "conduit.worker.labels" . | nindent 4 }}
