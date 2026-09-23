# break-glass

> [!WARNING]
> Emergency, elevated-access remediation for install `{{ .nuon.install.id }}`. Use only
> during an incident — and use it *instead of* ad-hoc console access, so the elevated
> action is recorded, scoped and repeatable.

## What it does

1. **capture-state** — pods and recent events before anything changes. The run history
   is the incident record, so it starts with the evidence.
2. **elevated-remediation** — runs the **break_glass_remediation** action, which assumes
   the install's break-glass service account role (`{{ .nuon.install.id }}-app-break-glass`),
   prints the active identity and checks Secret Manager access, then force-rolls
   `kitchen-sink-api`, `kitchen-sink-ui` and `kitchen-sink-worker`.
3. **verify** — curls the public endpoint until it returns healthy, confirming the
   emergency action restored service.

## The role

Defined in [`break_glass.toml`](../break_glass.toml) with the predefined
`roles/editor` role. The action's `break_glass_role` field binds the two together, so
the elevated credentials exist only for the duration of that recorded step.

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

Because the alternative is someone logging into a project under a shared
admin role at 3 a.m. with no record of what they touched. Here the elevated role is
declared in config, reviewed like the rest of it, and every
invocation is a workflow record with who, what and when.
