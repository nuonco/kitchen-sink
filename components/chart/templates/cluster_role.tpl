apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: {{ .Values.namespace }}-cluster-role
  labels:
    {{- include "conduit.labels" . | nindent 4 }}
rules:
  - apiGroups: [""]
    resources: ["namespaces", "pods", "services", "secrets", "configmaps", "events"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list", "watch"]
