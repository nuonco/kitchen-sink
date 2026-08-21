# pause-pipelines

> [!WARNING]
> Emergency, elevated-access procedure for install `{{ .nuon.install.id }}`. Use it
> during an incident *instead of* ad-hoc console access, so the elevated action is
> recorded, scoped and repeatable.

Pauses every sync pipeline, proves the engine starts nothing new, then resumes. Run
as shipped it is a drill whose every step is real; in a real emergency the pause is
the point — stop there and leave the pipelines paused.

## What it does

1. **capture-state** — pods and recent events before anything changes. The run history
   is the incident record, so it starts with the evidence.
2. **pause-and-verify** — runs the **pause_pipelines** action, which assumes the
   install's break-glass IAM role (`{{ .nuon.install.id }}-app-break-glass`), prints
   the assumed caller identity as proof, demonstrates that the role's
   `secretsmanager:*` Deny boundary holds, then sets `paused = true` on every row of
   the live pipelines table, waits 60 seconds, and verifies that zero new sync runs
   started before resuming.
3. **verify** — reads `/api/sync/pipelines` through the public endpoint until every
   pipeline reports `paused: false`, confirming the drill ended with syncs running.

## The role

Defined in [`break_glass.toml`](../break_glass.toml): `AdministratorAccess`, minus an
explicit `Deny` on `secretsmanager:*`. The action's `break_glass_role` field binds the
two together — the elevated credentials exist only for the duration of that step, and
only with that boundary.

The action deliberately calls `aws secretsmanager list-secrets` and expects it to
fail. An `AccessDenied` there is the demo: admin access, still fenced.

## Verification target

{{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }}
<nuon-group gap="8" align="center">
  <nuon-badge theme="info" variant="code">GET</nuon-badge>
  <nuon-badge theme="default" variant="code">https://app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}/api/sync/pipelines</nuon-badge>
</nuon-group>
{{ else }}
The verification target is available once the sandbox is deployed.
{{ end }}

## Why run this *as a runbook*

Because the alternative is someone logging into a customer's account under a shared
admin role at 3 a.m. with no record of what they touched. Here the elevated role is
declared in config, reviewed like the rest of it, scoped by an explicit Deny, and
every invocation is a workflow record with who, what and when. Run it from this
install's **Runbooks** tab, or paste the request into your coding agent.
