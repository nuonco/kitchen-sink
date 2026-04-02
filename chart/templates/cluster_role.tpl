apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: {{ .Values.namespace }}-cluster-role
  labels:
    {{- include "kitchen-sink.labels" . | nindent 4 }}
rules:
  - apiGroups: [""]
    resources: ["namespaces", "pods", "services", "secrets", "configmaps"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list", "watch"]
