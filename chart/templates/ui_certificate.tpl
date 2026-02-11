---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: {{ include "common.fullname" . }}-ui-public
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "common.uiLabels" . | nindent 4 }}
spec:
  secretName: kitchen-sink-ui-ingress-public-tls
  dnsNames:
    - {{ .Values.ui.ingresses.public_domain }}
  issuerRef:
    name: public-issuer
    kind: ClusterIssuer
