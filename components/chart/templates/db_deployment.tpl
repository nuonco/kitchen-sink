apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "relay.db.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "relay.db.labels" . | nindent 4 }}
spec:
  replicas: 1
  # Recreate: never two Postgres pods at once for the same store.
  strategy:
    type: Recreate
  selector:
    matchLabels:
      {{- include "relay.db.labels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "relay.db.labels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ .Values.serviceAccount }}
      containers:
        - name: db
          image: {{ .Values.db.image }}
          env:
            - name: POSTGRES_DB
              value: {{ .Values.db.database | quote }}
            - name: POSTGRES_USER
              value: {{ .Values.db.user | quote }}
            # The same Nuon-synced secret the api and worker read — the
            # db_password secret finally has a real consumer.
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.db.passwordSecret.name }}
                  key: {{ .Values.db.passwordSecret.key }}
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          ports:
            - containerPort: {{ .Values.db.port }}
              protocol: TCP
          livenessProbe:
            exec:
              command: ["pg_isready", "-U", "{{ .Values.db.user }}", "-d", "{{ .Values.db.database }}"]
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "{{ .Values.db.user }}", "-d", "{{ .Values.db.database }}"]
            initialDelaySeconds: 5
            periodSeconds: 5
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
          resources:
            {{- toYaml .Values.db.resources | nindent 12 }}
      volumes:
        # emptyDir on purpose — see the `db:` comment in values.yaml.
        - name: data
          emptyDir: {}
