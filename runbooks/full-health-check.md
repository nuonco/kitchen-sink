# full-health-check

Checks install `{{ .nuon.install.id }}` at every layer that has to be working for
Relay to accept and deliver events — from the nodes up to the public HTTPS endpoint.

Read-only: nothing here applies a change.

## What it checks

1. **node-health** — node readiness and capacity (`kubectl get nodes`, `kubectl top nodes`).
2. **workload-health** — runs the existing **cron_status** action, which reports the
   `relay` namespace's pods, services and ingresses and emits `pods_ready` /
   `pods_total` as structured outputs.
3. **rollout-convergence** — `kubectl rollout status` for `relay-api`,
   `relay-ui` and `relay-worker`, plus the HPAs. Ready pods are not the
   same as a converged rollout; this step asserts convergence.
4. **ingress-health** — the Helm releases in the namespace and a full describe of the
   `relay-alb` ingress, which is where the AWS Load Balancer Controller reports
   target-group and certificate problems.
5. **endpoint-health** — curls the public endpoint and only passes on a healthy HTTP
   status, retrying while DNS and the target group settle.

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

After a deploy you want to confirm by hand, before handing an install to a customer,
or as the first thing you do when someone reports deliveries are slow. If it comes back
clean and the customer still sees a problem, the problem is above this stack —
go to [`debug-bundle`](./debug-bundle.md) next.

Component Health already reports this continuously per component. This runbook is the
on-demand, single-transcript version: one workflow record you can link to in a ticket.
