{{- if .Values.ui.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "conduit.ui.name" . }}-public
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "conduit.ui.labels" . | nindent 4 }}
  annotations:
    kubernetes.io/ingress.class: "nginx"
spec:
  rules:
    - host: {{ .Values.ui.ingress.publicHost }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ include "conduit.ui.name" . }}
                port:
                  number: {{ .Values.ui.port }}
{{- end }}
