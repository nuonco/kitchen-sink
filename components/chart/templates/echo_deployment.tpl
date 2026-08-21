apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "relay.echo.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "relay.echo.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.echo.replicas }}
  selector:
    matchLabels:
      {{- include "relay.echo.labels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "relay.echo.labels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ .Values.serviceAccount }}
      containers:
        - name: echo
          image: {{ .Values.echo.image }}
          command: ["/bin/api"]
          env:
            - name: RELAY_MODE
              value: "echo"
            - name: ECHO_ADDR
              value: ":{{ .Values.echo.port }}"
          ports:
            - containerPort: {{ .Values.echo.port }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: {{ .Values.probes.liveness }}
              port: {{ .Values.echo.port }}
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: {{ .Values.probes.readiness }}
              port: {{ .Values.echo.port }}
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            {{- toYaml .Values.echo.resources | nindent 12 }}
