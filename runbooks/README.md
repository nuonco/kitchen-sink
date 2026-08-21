# Runbooks

Named, multi-step operational procedures you run on demand against a single install —
from the dashboard's **Runbooks** tab or `nuon runbooks list --install-id <id>` and
`nuon runbooks create-run`. Each runbook is a `<name>.toml` (the steps) plus a
`<name>.md` (a README rendered against the install's live state).

Every step here operates on something this app actually has: the components
`relay`, `application_load_balancer`, `certificate`, `pulumi_infra`, and the
actions `cron_status`, `debug`, `break_glass_remediation`.

| Runbook | Scenario | Steps |
|---------|----------|-------|
| [`full-health-check`](./full-health-check.md) | **Health check** — many signals at once, read-only | nodes → `cron_status` → rollout convergence → ALB ingress → public endpoint |
| [`debug-bundle`](./debug-bundle.md) | **Debug** — something's gone wrong, read-only | `debug` → pod/restart detail → ingress + synced secrets → endpoint probe |
| [`reconcile-drift`](./reconcile-drift.md) | **Drift** — re-apply desired state (applies changes) | `plan_only` chart plan → `sandbox_reprovision` → `pulumi_infra` → `certificate` → `relay` + dependents → verify |
| [`break-glass`](./break-glass.md) | **Break glass** — recorded emergency with elevated access | capture state → `break_glass_remediation` (assumes the break-glass role) → verify |

## Step types used

- `action` — run an existing action by `action_name`, or an inline `command` /
  `inline_contents` with `timeout` and `env_vars`.
- `component_deploy` — deploy a component, optionally with its transitive dependents
  (`deploy_dependents`) or as a plan without applying (`plan_only`).
- `sandbox_reprovision` — re-apply the sandbox infrastructure, with
  `skip_component_deploys` to leave components alone.

`component_tear_down` and `sandbox_deprovision` also exist. They are deliberately not
used here: nothing in this app's day-two operations needs to destroy a customer's
infrastructure, and a runbook is exactly the wrong place to make that one click away.

## Relationship to actions and Component Health

- **Actions** (`../actions/`) are single scripts, and can run on a cron or a lifecycle
  hook. Runbooks compose them with component and sandbox operations into an ordered
  procedure, and can only be run on demand.
- **Component Health** (`[health]` in the component configs) reports continuously and
  independently of the last deploy. `full-health-check` is the on-demand version that
  produces one linkable transcript.
- **App branches** can run a runbook automatically on each install after its deploy
  succeeds — see `post_deploy_runbooks` in [`../branch.toml`](../branch.toml).

See the [Runbooks guide](https://docs.nuon.co/guides/runbooks) for the full schema.
