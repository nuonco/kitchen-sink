apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "periscope.collector.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "periscope.collector.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.worker.replicas }}
  selector:
    matchLabels:
      {{- include "periscope.collector.labels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "periscope.collector.labels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ .Values.serviceAccount }}
      containers:
        - name: worker
          image: {{ .Values.worker.image }}
          command: ["/bin/worker"]
          env:
            - name: HEALTH_ADDR
              value: ":{{ .Values.worker.port }}"
          ports:
            - name: health
              containerPort: {{ .Values.worker.port }}
              protocol: TCP
          resources:
            {{- toYaml .Values.worker.resources | nindent 12 }}
