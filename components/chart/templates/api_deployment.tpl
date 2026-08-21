apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "conduit.api.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "conduit.api.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.api.replicas }}
  selector:
    matchLabels:
      {{- include "conduit.api.labels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "conduit.api.labels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ .Values.serviceAccount }}
      containers:
        - name: api
          image: {{ .Values.api.image }}
          command: ["/bin/api"]
          env:
            # Read-only access to the sync engine's state for the /sync
            # endpoints. The api holds no AWS credentials — S3_BUCKET (from
            # api.env) is display-only.
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
            {{- range $name, $value := .Values.api.env }}
            - name: {{ $name }}
              value: {{ $value | quote }}
            {{- end }}
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
