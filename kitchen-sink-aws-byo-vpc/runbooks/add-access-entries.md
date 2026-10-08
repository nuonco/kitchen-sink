{{- $workflows := dig "actions" "workflows" (dict) (default (dict) .nuon) -}}
{{- $action := default (dict) (dig "install_access_entries" (dict) $workflows) -}}
{{- $entries := default (dict) (dig "outputs" (dict) $action) -}}

Recreates the EKS access entries for `{{ .nuon.install.id }}-provision`,
`{{ .nuon.install.id }}-deprovision`, and `{{ .nuon.install.id }}-app-break-glass`
with `AmazonEKSClusterAdminPolicy` at cluster scope. Existing entries are
deleted and created again, since an entry stays bound to the IAM role that
existed when it was created and stops working once that role is recreated.
Safe to re-run.

Runs as `{{ .nuon.install.id }}-access-entries-break-glass`, which must be
enabled in the install stack.

<nuon-banner theme="info">When the customer applies the stack with that role enabled, the stack's phone-home webhook fires a <code>role-enabled</code> trigger that runs this automatically.</nuon-banner>

Release flow:

1. Customer enables the roles, including the access-entries break-glass role.
2. This runbook runs (automatically, or click **Run**).
3. Deploy.
4. Run `remove-access-entries`.
5. Customer disables the roles.

Last run: {{ with dig "completed_at" "" $action }}<nuon-time time="{{ . }}" format="relative"></nuon-time>{{ else }}never{{ end }}.

| Role | Principal ARN | State | Policy |
| --- | --- | --- | --- |
{{ range $role, $e := $entries -}}
{{- if and (kindIs "map" $e) (ne $role "steps") -}}
| `{{ $role }}` | `{{ default "—" (dig "principal_arn" "" $e) }}` | {{ default "—" (dig "state" "" $e) }} | `{{ default "—" (dig "policy_arn" "" $e) }}` |
{{ end -}}
{{ end -}}

<nuon-group gap="8">
<nuon-run-runbook name="remove-access-entries"></nuon-run-runbook>
</nuon-group>
