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
          env:
            - name: HEALTH_ADDR
              value: ":{{ .Values.worker.port }}"
            - name: API_URL
              value: "http://{{ include "kitchen-sink.api.name" . }}:{{ .Values.api.port }}"
            - name: DEMO_PROFILE
              value: {{ (.Values.telemetry).demoProfile | default "steady" | quote }}
            {{- with include "kitchen-sink.telemetry.env" (dict "root" . "service" "kitchen-sink-worker") }}
            {{- . | nindent 12 }}
            {{- end }}
          ports:
            - name: health
              containerPort: {{ .Values.worker.port }}
              protocol: TCP
          resources:
            {{- toYaml .Values.worker.resources | nindent 12 }}
