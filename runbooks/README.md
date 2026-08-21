# Runbooks

Named, multi-step operational procedures you run on demand against a single install —
from the dashboard's **Runbooks** tab, or by pasting the request into your coding
agent (`nuon runbooks list --install-id <id>` shows what's available; creating runs
via the CLI is broken platform-side right now, so the dashboard and agent paths are
the ones that work). Each runbook is a `<name>.toml` (the steps) plus a `<name>.md`
(a README rendered against the install's live state).

Every step here operates on something this app actually has: the components
`conduit`, `application_load_balancer`, `certificate`, `destination_bucket`, and the
actions `sync_heartbeat`, `debug`, `pause_pipelines`.

| Runbook | Scenario | Steps |
|---------|----------|-------|
| [`pipeline-health-sweep`](./pipeline-health-sweep.md) | **Health check** — many signals at once, read-only | nodes → `sync_heartbeat` → rollout convergence → ALB ingress → public endpoint → sync freshness |
| [`debug-bundle`](./debug-bundle.md) | **Debug** — something's gone wrong, read-only | `debug` → pod/restart detail + engine and postgres logs → ingress + synced secrets → endpoint probe |
| [`reconcile-drift`](./reconcile-drift.md) | **Drift** — re-apply desired state (applies changes) | `plan_only` chart plan → `sandbox_reprovision` → `destination_bucket` → `certificate` → `conduit` + dependents → verify |
| [`pause-pipelines`](./pause-pipelines.md) | **Emergency** — pause every pipeline, recorded and elevated | capture state → `pause_pipelines` (assumes the break-glass role, pauses, verifies, resumes) → verify via the status API |

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
  independently of the last deploy. `pipeline-health-sweep` is the on-demand version
  that produces one linkable transcript.
- **App branches** can run a runbook automatically on each install after its deploy
  succeeds — see `post_deploy_runbooks` in [`../branch.toml`](../branch.toml).

See the [Runbooks guide](https://docs.nuon.co/guides/runbooks) for the full schema.
