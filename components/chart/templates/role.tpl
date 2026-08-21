apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: {{ .Values.namespace }}-cluster-role-binding
  labels:
    {{- include "relay.labels" . | nindent 4 }}
subjects:
  - kind: ServiceAccount
    name: {{ .Values.serviceAccount }}
    namespace: {{ .Values.namespace }}
roleRef:
  kind: ClusterRole
  name: {{ .Values.namespace }}-cluster-role
  apiGroup: rbac.authorization.k8s.io
