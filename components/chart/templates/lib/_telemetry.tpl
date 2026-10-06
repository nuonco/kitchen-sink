{{- /*
OTel SDK environment for the instrumented containers (api, worker). Renders
nothing unless telemetry.enabled, so the binaries' telemetry stays a no-op.
Usage: include "kitchen-sink.telemetry.env" (dict "root" . "service" "kitchen-sink-api")
*/ -}}
{{- define "kitchen-sink.telemetry.env" -}}
{{- $t := .root.Values.telemetry | default dict -}}
{{- if $t.enabled -}}
- name: POD_NAME
  valueFrom:
    fieldRef:
      fieldPath: metadata.name
- name: POD_NAMESPACE
  valueFrom:
    fieldRef:
      fieldPath: metadata.namespace
- name: POD_UID
  valueFrom:
    fieldRef:
      fieldPath: metadata.uid
- name: NODE_NAME
  valueFrom:
    fieldRef:
      fieldPath: spec.nodeName
- name: OTEL_SERVICE_NAME
  value: {{ .service | quote }}
- name: OTEL_EXPORTER_OTLP_ENDPOINT
  value: {{ $t.endpoint | quote }}
- name: OTEL_EXPORTER_OTLP_PROTOCOL
  value: "http/protobuf"
- name: OTEL_RESOURCE_ATTRIBUTES
  value: "service.namespace=kitchen-sink,service.version={{ $t.serviceVersion }},service.instance.id=$(POD_UID),k8s.namespace.name=$(POD_NAMESPACE),k8s.pod.name=$(POD_NAME),k8s.pod.uid=$(POD_UID),k8s.node.name=$(NODE_NAME)"
{{- end }}
{{- end }}
