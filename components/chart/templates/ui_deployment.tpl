apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "conduit.ui.name" . }}
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "conduit.ui.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.ui.replicas }}
  selector:
    matchLabels:
      {{- include "conduit.ui.labels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "conduit.ui.labels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ .Values.serviceAccount }}
      containers:
        - name: ui
          image: {{ .Values.ui.image }}
          ports:
            - containerPort: {{ .Values.ui.port }}
              protocol: TCP
          env:
            - name: LISTEN_ADDR
              value: ":{{ .Values.ui.port }}"
            # Everything under ui.env, so adding a value there is enough to get
            # it into the container. API_URL comes through here; the NUON_* vars
            # are what /api/ui-config serves to the frontend.
            {{- range $name, $value := .Values.ui.env }}
            - name: {{ $name }}
              value: {{ $value | quote }}
            {{- end }}
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
