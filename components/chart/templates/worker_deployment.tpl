apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "conduit.worker.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "conduit.worker.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.worker.replicas }}
  selector:
    matchLabels:
      {{- include "conduit.worker.labels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "conduit.worker.labels" . | nindent 8 }}
    spec:
      # The sync engine's own ServiceAccount: its IRSA annotation (see
      # worker_service_account.tpl) is what lets this pod — and only this pod —
      # write to the destination bucket.
      serviceAccountName: {{ .Values.worker.serviceAccount }}
      containers:
        - name: worker
          image: {{ .Values.worker.image }}
          command: ["/bin/worker"]
          env:
            - name: HEALTH_ADDR
              value: ":{{ .Values.worker.port }}"
            - name: PGHOST
              value: {{ include "conduit.postgres.name" . }}
            - name: PGPORT
              value: {{ .Values.postgres.port | quote }}
            - name: PGUSER
              value: {{ .Values.postgres.user }}
            - name: PGDATABASE
              value: {{ .Values.postgres.database }}
            # From the db-password install secret (kubernetes_sync), never a
            # literal; /introspect/env redacts it by the PASSWORD fragment.
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-password
                  key: db_password
            # S3_BUCKET and AWS_REGION arrive through worker.env
            # (Nuon-interpolated from destination_bucket outputs).
            {{- range $name, $value := .Values.worker.env }}
            - name: {{ $name }}
              value: {{ $value | quote }}
            {{- end }}
          ports:
            - name: health
              containerPort: {{ .Values.worker.port }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: {{ .Values.probes.liveness }}
              port: {{ .Values.worker.port }}
            initialDelaySeconds: 5
            periodSeconds: 10
          # /readyz is real readiness: it returns 503 until the engine's DB
          # ping succeeds, so the rollout (and Nuon's health assessment) show
          # a worker that cannot reach postgres honestly.
          readinessProbe:
            httpGet:
              path: {{ .Values.probes.readiness }}
              port: {{ .Values.worker.port }}
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            {{- toYaml .Values.worker.resources | nindent 12 }}
