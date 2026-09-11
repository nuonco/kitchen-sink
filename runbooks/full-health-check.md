# full-health-check

Checks install `{{ .nuon.install.id }}` at every layer that has to be working for the
app to serve traffic — from the nodes up to the public HTTPS endpoint.

Read-only: nothing here applies a change.

## What it checks

Each step runs a named action and writes structured outputs that the install README renders.

1. **health_nodes** — node readiness and capacity.
2. **cron_status** — workloads, pods, and services in the `kitchen-sink` namespace.
3. **health_rollout** — deployment convergence for the three app components.
4. **health_ingress** — the ALB ingress resource and how many endpoints it backs.
5. **health_endpoint** — public HTTPS endpoint health.

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
or as the first thing you do when someone reports the app is slow. If it comes back
clean and the customer still sees a problem, the problem is above this stack —
go to [`debug-bundle`](./debug-bundle.md) next.

Component Health reports this continuously, per component. Running this once produces a
single workflow record you can link to in a ticket.
