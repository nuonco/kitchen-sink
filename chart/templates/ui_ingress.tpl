---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "common.fullname" . }}-ui-public
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "common.uiLabels" . | nindent 4 }}
  annotations:
    external-dns.alpha.kubernetes.io/hostname: {{ .Values.ui.ingresses.public_domain }}
    kubernetes.io/ingress.class: nginx
spec:
  tls:
  - hosts:
    - {{ .Values.ui.ingresses.public_domain }}
    secretName: kitchen-sink-ui-ingress-public-tls
  rules:
    - host: {{ .Values.ui.ingresses.public_domain }}
      http:
        paths:
        - path: /
          pathType: Prefix
          backend:
            service:
              name: {{ include "common.fullname" . }}-ui
              port:
                number: 80
