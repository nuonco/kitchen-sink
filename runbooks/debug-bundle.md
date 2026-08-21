# debug-bundle

Collects a diagnostic bundle for install `{{ .nuon.install.id }}` in one workflow
record, so an incident has a single artifact to attach rather than a scrollback.

Read-only: nothing here restarts, applies or deletes anything.

## What it collects

1. **collect-diagnostics** — runs the existing **debug** action: pods, recent events,
   Helm releases, and the last 100 log lines from the API and UI deployments.
2. **workload-detail** — `describe` for every deployment and pod, a restart-count and
   last-terminated-reason table, plus the last log lines from the sync engine
   (`conduit-worker`) and from `conduit-postgres`, where the pipelines and run history
   live. This is where `OOMKilled`, `ImagePullBackOff`, `CrashLoopBackOff` and failed
   sync runs show up with their reasons attached.
3. **ingress-and-secrets** — services and ingresses, a full describe of the
   `conduit-alb` ingress, and confirmation that the Nuon-synced secrets
   (`db-password`, `api-key`) exist in the namespace. Names only — never values.
4. **endpoint-probe** — one verbose curl of the public endpoint with the status code
   and total time, tolerant of failure so the bundle always completes.

## Endpoint probed

{{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }}
<nuon-group gap="8" align="center">
  <nuon-badge theme="info" variant="code">GET</nuon-badge>
  <nuon-badge theme="default" variant="code">https://app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}/livez</nuon-badge>
</nuon-group>
{{ else }}
The endpoint is available once the sandbox is deployed.
{{ end }}

## Why a runbook and not a support call

Everything here runs on the runner inside the account the install lives in. Nobody
hands over credentials, joins a VPN, or shares a screen — and the output lands in the
install's workflow history where support and engineering can both read it.

If the bundle shows drift rather than a crash, run
[`reconcile-drift`](./reconcile-drift.md). If it shows something that needs elevated
access to fix, run [`pause-pipelines`](./pause-pipelines.md).
