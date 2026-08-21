# The source database. Single replica on an emptyDir (see values.yaml
# `postgres:` for the durability rationale): the initdb ConfigMap re-seeds an
# empty data dir, so a restart self-heals into a working state and the worker
# re-syncs within a minute.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "conduit.postgres.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "conduit.postgres.labels" . | nindent 4 }}
spec:
  replicas: 1
  # Recreate, never rolling: two postgres pods sharing nothing on emptyDirs
  # would briefly serve split state.
  strategy:
    type: Recreate
  selector:
    matchLabels:
      {{- include "conduit.postgres.labels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "conduit.postgres.labels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ .Values.serviceAccount }}
      containers:
        - name: postgres
          image: {{ .Values.postgres.image }}
          env:
            - name: POSTGRES_USER
              value: {{ .Values.postgres.user }}
            - name: POSTGRES_DB
              value: {{ .Values.postgres.database }}
            # From the db-password install secret (kubernetes_sync) — the same
            # secret the api and worker read PGPASSWORD from.
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-password
                  key: db_password
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          ports:
            - name: postgres
              containerPort: {{ .Values.postgres.port }}
              protocol: TCP
          livenessProbe:
            exec:
              command: ["pg_isready", "-U", "{{ .Values.postgres.user }}", "-d", "{{ .Values.postgres.database }}"]
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "{{ .Values.postgres.user }}", "-d", "{{ .Values.postgres.database }}"]
            initialDelaySeconds: 5
            periodSeconds: 5
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
            # The postgres entrypoint runs these exactly once per fresh data
            # dir — schema, seed rows, and pipeline registration.
            - name: initdb
              mountPath: /docker-entrypoint-initdb.d
              readOnly: true
          resources:
            {{- toYaml .Values.postgres.resources | nindent 12 }}
      volumes:
        - name: data
          emptyDir: {}
        - name: initdb
          configMap:
            name: {{ include "conduit.postgres.name" . }}-init
