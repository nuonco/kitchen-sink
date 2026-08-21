{{- if and .Values.api.ingress .Values.api.ingress.internalHost }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "periscope.api.name" . }}-internal
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "periscope.api.labels" . | nindent 4 }}
  annotations:
    kubernetes.io/ingress.class: "internal-nginx"
spec:
  rules:
    - host: {{ .Values.api.ingress.internalHost }}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {{ include "periscope.api.name" . }}
                port:
                  number: {{ .Values.api.port }}
{{- end }}
