apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "kitchen-sink.ui.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "kitchen-sink.ui.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.ui.replicas }}
  selector:
    matchLabels:
      {{- include "kitchen-sink.ui.labels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "kitchen-sink.ui.labels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ .Values.serviceAccount }}
      containers:
        - name: ui
          image: {{ .Values.ui.image }}
          ports:
            - containerPort: {{ .Values.ui.port }}
              protocol: TCP
          env:
            - name: API_URL
              value: {{ .Values.ui.env.API_URL }}
            - name: LISTEN_ADDR
              value: ":{{ .Values.ui.port }}"
          livenessProbe:
            httpGet:
              path: {{ .Values.probes.liveness }}
              port: {{ .Values.ui.port }}
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: {{ .Values.probes.readiness }}
              port: {{ .Values.ui.port }}
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            {{- toYaml .Values.ui.resources | nindent 12 }}
