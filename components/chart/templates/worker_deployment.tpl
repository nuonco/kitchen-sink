apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "relay.worker.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "relay.worker.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.worker.replicas }}
  selector:
    matchLabels:
      {{- include "relay.worker.labels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "relay.worker.labels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ .Values.serviceAccount }}
      containers:
        - name: worker
          image: {{ .Values.worker.image }}
          # Same image and binary as the api; RELAY_MODE selects the delivery
          # engine (/bin/worker still exists as a compat shim for old charts).
          command: ["/bin/api"]
          env:
            - name: RELAY_MODE
              value: "worker"
            - name: HEALTH_ADDR
              value: ":{{ .Values.worker.port }}"
            {{- include "relay.db.env" . | nindent 12 }}
          ports:
            - name: health
              containerPort: {{ .Values.worker.port }}
              protocol: TCP
          resources:
            {{- toYaml .Values.worker.resources | nindent 12 }}
