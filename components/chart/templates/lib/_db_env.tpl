{{/*
The delivery-store connection env shared by the api and worker containers.
DB_PASSWORD comes from the Nuon-synced db-password Secret (secrets.toml
declares db_password with kubernetes_sync; the sync stores the value under a
key named after the Nuon secret) — never templated into values, so the
chart's configmap storage never holds it in plaintext.
*/}}
{{- define "relay.db.env" -}}
- name: DB_HOST
  value: {{ include "relay.db.name" . }}
- name: DB_PORT
  value: {{ .Values.db.port | quote }}
- name: DB_NAME
  value: {{ .Values.db.database | quote }}
- name: DB_USER
  value: {{ .Values.db.user | quote }}
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ .Values.db.passwordSecret.name }}
      key: {{ .Values.db.passwordSecret.key }}
{{- end }}
