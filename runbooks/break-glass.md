# break-glass

> [!WARNING]
> Emergency, elevated-access remediation for install `{{ .nuon.install.id }}`. Use only
> during an incident — and use it *instead of* ad-hoc console access, so the elevated
> action is recorded, scoped and repeatable.

## What it does

1. **capture-state** — pods and recent events before anything changes. The run history
   is the incident record, so it starts with the evidence.
2. **elevated-remediation** — runs the **break_glass_remediation** action, which assumes
   the install's break-glass IAM role (`{{ .nuon.install.id }}-app-break-glass`), prints
   the assumed caller identity as proof, demonstrates that the role's
   `secretsmanager:*` Deny boundary holds, and then force-rolls
   `relay-api`, `relay-ui` and `relay-worker`.
3. **verify** — curls the public endpoint until it returns healthy, confirming the
   emergency action restored service.

## The role

Defined in [`break_glass.toml`](../break_glass.toml): `AdministratorAccess`, minus an
explicit `Deny` on `secretsmanager:*`. The action's `break_glass_role` field is what
binds the two together — the elevated credentials exist only for the duration of that
step, and only with that boundary.

The remediation step deliberately calls `aws secretsmanager list-secrets` and expects it
to fail. An `AccessDenied` there is the demo: admin access, still fenced.

## Verification target

{{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }}
<nuon-group gap="8" align="center">
  <nuon-badge theme="info" variant="code">GET</nuon-badge>
  <nuon-badge theme="default" variant="code">https://app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}/livez</nuon-badge>
</nuon-group>
{{ else }}
The verification target is available once the sandbox is deployed.
{{ end }}

## Why run break-glass *as a runbook*

Because the alternative is someone logging into a customer's account under a shared
admin role at 3 a.m. with no record of what they touched. Here the elevated role is
declared in config, reviewed like the rest of it, scoped by an explicit Deny, and every
invocation is a workflow record with who, what and when.
