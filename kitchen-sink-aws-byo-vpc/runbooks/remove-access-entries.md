{{- $workflows := dig "actions" "workflows" (dict) (default (dict) .nuon) -}}
{{- $action := default (dict) (dig "remove_access_entries" (dict) $workflows) -}}
{{- $entries := default (dict) (dig "outputs" (dict) $action) -}}

Deletes the EKS access entries for `{{ .nuon.install.id }}-provision`,
`{{ .nuon.install.id }}-deprovision`, and `{{ .nuon.install.id }}-app-break-glass`.

<nuon-banner theme="warning">Runs as <code>{{ .nuon.install.id }}-access-entries-break-glass</code>. Run this <b>before</b> the customer disables that role; it cannot run afterward.</nuon-banner>

Last run: {{ with dig "completed_at" "" $action }}<nuon-time time="{{ . }}" format="relative"></nuon-time>{{ else }}never{{ end }}.

| Role | Principal ARN | State | Existed |
| --- | --- | --- | --- |
{{ range $role, $e := $entries -}}
{{- if ne $role "steps" -}}
| `{{ $role }}` | `{{ default "—" (dig "principal_arn" "" $e) }}` | {{ default "—" (dig "state" "" $e) }} | {{ dig "existed" "—" $e }} |
{{ end -}}
{{ end -}}

<nuon-group gap="8">
<nuon-run-runbook name="add-access-entries"></nuon-run-runbook>
</nuon-group>
