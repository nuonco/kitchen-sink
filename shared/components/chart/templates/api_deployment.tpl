apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "kitchen-sink.api.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "kitchen-sink.api.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.api.replicas }}
  selector:
    matchLabels:
      {{- include "kitchen-sink.api.labels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "kitchen-sink.api.labels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ .Values.serviceAccount }}
      containers:
        - name: api
          image: {{ .Values.api.image }}
          command: ["/bin/api"]
          ports:
            - containerPort: {{ .Values.api.port }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: {{ .Values.probes.liveness }}
              port: {{ .Values.api.port }}
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: {{ .Values.probes.readiness }}
              port: {{ .Values.api.port }}
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            {{- toYaml .Values.api.resources | nindent 12 }}
