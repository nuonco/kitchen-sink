# reconcile-drift

Re-applies desired state to install `{{ .nuon.install.id }}` after someone changed
something out of band — a hand-edited deployment, a deleted security group, a
Terraform resource removed in the console.

> [!WARNING]
> This runbook **applies changes**. It reprovisions the sandbox and redeploys
> components. Run [`pipeline-health-sweep`](./pipeline-health-sweep.md) or
> [`debug-bundle`](./debug-bundle.md) first if you are not yet sure drift is the problem.

## What it does

1. **drift-plan** — plans the `conduit` chart with `plan_only`, so the run records
   exactly what drifted before anything is applied.
2. **reconcile-sandbox** — reprovisions the sandbox with `skip_component_deploys`, so
   the EKS cluster, VPC and DNS are brought back to desired state without a blind
   redeploy of everything on top of them.
3. **reconcile-destination-bucket** — redeploys `destination_bucket`: the bucket syncs
   land in and the IAM role the sync engine writes with. Its config reads the install
   stack's region, so it has to follow the sandbox.
4. **reconcile-certificate** — redeploys `certificate`. Its ACM validation records live
   in the sandbox's Route53 zone, so it is re-applied after the sandbox and before the
   load balancer that consumes its ARN.
5. **reconcile-app** — redeploys `conduit` with `deploy_dependents`, which rolls
   `application_load_balancer` out immediately afterwards in dependency order.
6. **verify** — curls the public endpoint until it returns healthy, retrying while the
   new target group registers.

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

The steps follow this app's real dependency graph: sandbox → `destination_bucket` →
`certificate` → `conduit` → `application_load_balancer`. Reprovisioning the sandbox
can change the zone ID and outputs that the certificate and load balancer template
against, so re-applying them in any other order leaves the install pointing at values
that no longer exist.
