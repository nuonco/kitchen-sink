# reconcile-drift

Re-applies desired state to install `{{ .nuon.install.id }}` after someone changed
something out of band — a hand-edited deployment, a deleted firewall rule, a
Terraform resource removed in the console.

> [!WARNING]
> This runbook **applies changes**. It reprovisions the sandbox and redeploys
> components. Run [`full-health-check`](./full-health-check.md) or
> [`debug-bundle`](./debug-bundle.md) first if you are not yet sure drift is the problem.

## What it does

1. **drift-plan** — plans the `kitchen_sink` chart with `plan_only`, so the run records
   exactly what drifted before anything is applied.
2. **reconcile-sandbox** — reprovisions the sandbox with `skip_component_deploys`, so
   the GKE cluster, VPC network and DNS are brought back to desired state without a blind
   redeploy of everything on top of them.
3. **reconcile-pulumi-infra** — redeploys `pulumi_infra`, whose config reads the
   install stack's region and so has to follow the sandbox.
4. **reconcile-certificate** — redeploys `certificate` and its Cloud DNS validation records.
5. **reconcile-external-dns** — redeploys the in-cluster Cloud DNS reconciler.
6. **reconcile-app** — redeploys `kitchen_sink` with `deploy_dependents`, which rolls
   `gateway` out immediately afterwards in dependency order.
7. **verify** — curls the public endpoint until it returns healthy.

## Verification target

{{ if and .nuon.sandbox.populated .nuon.sandbox.outputs }}
<nuon-group gap="8" align="center">
  <nuon-badge theme="info" variant="code">GET</nuon-badge>
  <nuon-badge theme="default" variant="code">https://app.{{ .nuon.sandbox.outputs.nuon_dns.public_domain.name }}/livez</nuon-badge>
</nuon-group>
{{ else }}
The verification target is available once the sandbox is deployed.
{{ end }}

## Why the order matters

The steps follow this app's real dependency graph: sandbox → `pulumi_infra` →
`certificate` + `external_dns` → `kitchen_sink` → `gateway`. Reprovisioning the
sandbox can change the zone ID and cluster outputs those components use.
