{{- if and .Values.api.ingress .Values.api.ingress.internalHost }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "conduit.api.name" . }}-internal
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "conduit.api.labels" . | nindent 4 }}
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
                name: {{ include "conduit.api.name" . }}
                port:
                  number: {{ .Values.api.port }}
{{- end }}
