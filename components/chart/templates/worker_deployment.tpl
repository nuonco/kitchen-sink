apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "kitchen-sink.worker.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "kitchen-sink.worker.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.worker.replicas }}
  selector:
    matchLabels:
      {{- include "kitchen-sink.worker.labels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "kitchen-sink.worker.labels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ .Values.serviceAccount }}
      containers:
        - name: worker
          image: {{ .Values.worker.image }}
          command: ["/bin/worker"]
          resources:
            {{- toYaml .Values.worker.resources | nindent 12 }}
