---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "common.fullname" . }}-ui
  namespace: {{ .Release.Namespace }}
  labels:
    {{- include "common.uiLabels" . | nindent 4 }}
spec:
  selector:
    matchLabels:
      {{- include "common.uiSelectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "common.uiSelectorLabels" . | nindent 8 }}
    spec:
      serviceAccountName: {{ .Values.serviceAccount.name }}
      automountServiceAccountToken: true
      containers:
        - name: {{ include "common.fullname" . }}-ui
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          command:
            - python
            - -m
            - flask
            - run
            - --host=0.0.0.0
            - --port={{ .Values.ui.port }}
          ports:
            - name: http
              containerPort: {{ .Values.ui.port }}
              protocol: TCP
          readinessProbe:
            httpGet:
              path: {{ .Values.ui.readiness_probe }}
              port: http
          livenessProbe:
            httpGet:
              path: {{ .Values.ui.liveness_probe }}
              port: http
          resources:
            limits:
              cpu: 100m
              memory: 128Mi
            requests:
              cpu: 100m
              memory: 128Mi
          envFrom:
            - configMapRef:
                name: {{ include "common.fullname" . }}
          env:
            - name: API_URL
              value: "http://{{ include "common.fullname" . }}-api:80"
