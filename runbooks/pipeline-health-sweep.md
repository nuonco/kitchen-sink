# pipeline-health-sweep

Checks install `{{ .nuon.install.id }}` at every layer that has to be working for
syncs to land — from the nodes up to the public endpoint and the engine's own run
history.

Read-only: nothing here applies a change.

## What it checks

1. **node-health** — node readiness and capacity (`kubectl get nodes`, `kubectl top nodes`).
2. **workload-health** — runs the **sync_heartbeat** action: the `conduit` namespace's
   pods, services and ingresses, plus `pods_ready` / `pods_total` and the last hour's
   `syncs_succeeded_last_hour` / `syncs_failed_last_hour` as structured outputs, read
   straight from the pipelines database.
3. **rollout-convergence** — `kubectl rollout status` for `conduit-api`, `conduit-ui`,
   `conduit-worker` and `conduit-postgres`. Ready pods are not the same as a converged
   rollout; this step asserts convergence.
4. **ingress-health** — the Helm releases in the namespace and a full describe of the
   `conduit-alb` ingress, which is where the AWS Load Balancer Controller reports
   target-group and certificate problems.
5. **endpoint-health** — curls the public endpoint and only passes on a healthy HTTP
   status, retrying while DNS and the target group settle.
6. **sync-freshness** — reads `/api/sync/pipelines` through the public endpoint: per
   pipeline, the last run's status and age. Everything above can be green while syncs
   quietly stop; this is the step that notices.

## Target

{{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }}
<nuon-group gap="8" align="center">
  <nuon-badge theme="info" variant="code">GET</nuon-badge>
  <nuon-badge theme="default" variant="code">https://app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}/livez</nuon-badge>
</nuon-group>
{{ else }}
The target URL is available once the sandbox is deployed.
{{ end }}

## When to run it

Run it from this install's **Runbooks** tab, or paste the request into your coding
agent. After a deploy you want to confirm by hand, before handing an install to a
customer, or as the first thing you do when someone reports syncs are late. If it
comes back clean and the problem persists, go to
[`debug-bundle`](./debug-bundle.md) next.

Component Health already reports continuously per component. This runbook is the
on-demand, single-transcript version: one workflow record you can link to in a ticket.
