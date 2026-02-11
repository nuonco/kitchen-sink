---
apiVersion: v1
kind: Service
metadata:
  name: {{ include "common.fullname" . }}-ui
  labels:
    {{- include "common.uiLabels" . | nindent 4 }}
  namespace: {{ .Release.Namespace }}
spec:
  clusterIP: None
  ports:
    - name: http
      port: 80
      targetPort: http
  selector:
    {{- include "common.uiSelectorLabels" . | nindent 4 }}
