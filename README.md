# Periscope

A read-only infrastructure console vendors ship into each customer's cluster: live workloads, Helm state, Kubernetes events, all behind a redacting proxy. This repo packages it as a Nuon app — you sync the config once, and Nuon deploys the whole thing into an AWS account you point it at. (The git repo keeps its historical name; the product is Periscope.)

## Deploy it

You need a [Nuon account](https://app.nuon.co/) and an AWS account where you can create CloudFormation stacks.

```sh
brew install nuonco/tap/nuon        # other options: https://docs.nuon.co/cli
nuon auth login

git clone --branch ms/theme-periscope https://github.com/nuonco/kitchen-sink
cd kitchen-sink

nuon apps create --name kitchen-sink
nuon apps sync --app-id kitchen-sink

nuon installs create --app-id kitchen-sink --name my-first-install --region us-west-2
```

The app name matches the clone directory on purpose: `nuon sync` checks the directory basename against the app name and refuses on mismatch (add `--force` if you cloned to a different directory). The `--app-id` pin makes each command target this app regardless of which app your CLI last selected. The sync builds every component and waits for the builds to finish.

Every install input has a working default, including the domain — `nuon.run` is Nuon-provided, so the console lands at `app.<install-id>.nuon.run` with a real TLS certificate and no DNS setup.

`installs create` pauses at **await install stack**. Open the install in the [dashboard](https://app.nuon.co), copy the CloudFormation quick-create link from that step, and launch the stack while signed in to the target AWS account. The stack boots a runner inside that account; once it phones home, the runner does everything else itself — provisions the EKS sandbox, deploys the components in dependency order, runs the post-deploy health check. Nuon never needs inbound access to the account.

The install page is [`control-plane.md`](./control-plane.md) rendered live against the install's state; when the load balancer is up it links the console.

### What you'll see

The console opens on a system that is already doing things — none of it staged:

- The observed namespace (`<install-id>-observed`) runs a sample workload, and the activity generator ran a real Job at deploy time and schedules a new one every five minutes — live pods, completions, and events from the first minute.
- The post-deploy health check filed its report to the report archive (`periscope-reports-<install-id>`, under `health-reports/`); an hourly heartbeat adds `heartbeats/` snapshots, and its pod counts feed the health tile on the install page.
- The console's own guided tour takes it from there.

## What got deployed

| Component | Role in Periscope |
|---|---|
| `periscope` (Helm chart) | The console — `periscope-api`, `periscope-web`, `periscope-collector` in the `periscope` namespace |
| `img_api`, `img_ui` | The console's images. Pre-built by CI, which stamps the `tag =` lines in `components/images/` — never hand-edit those |
| `img_collector_premium` | Premium collector image in private ECR, pulled via an IAM role — the enterprise distribution path |
| `certificate`, `application_load_balancer` | The console's public HTTPS endpoint, health-probed from the runner |
| `pulumi_infra` | The report archive: an encrypted, versioned S3 bucket receiving debug bundles, health reports, and heartbeats |
| `observed_namespace`, `observed_workload` | The sample customer workload the console observes |
| `activity_generator` | CronJob creating short-lived Jobs in the observed namespace, so the console always has live activity to show |
| `audit_log_exporter` (toggleable, off) | The Enterprise SIEM export entitlement — gates the console's audit-log events feed |
| `tictactoe` (toggleable, off) | Toggle it on and look around the console |

## Change a feature

A push to the tracked branch is the whole ship interface: [`triggers.toml`](./triggers.toml) turns it into a staged branch run across the install groups in [`branch.toml`](./branch.toml) — staging, then customers, then enterprise, each gated on an approval.

Per-install features don't need a push. The SIEM export is toggleable and off by default; enabling it deploys the exporter and the console detects it and unlocks the audit-log feed:

```sh
nuon installs components toggle --install-id my-first-install --component-id audit_log_exporter --enable
```

Disabling tears it down the same way.

## Operate it

- **Watch**: `[health]` probes on the chart and load balancer report per-component health continuously; the `uptime_heartbeat` action counts pods every hour and archives a snapshot.
- **Follow the SOPs**: [`runbooks/`](./runbooks/README.md) hold the console's operating procedures — full health check, debug bundle, drift reconcile, break-glass. The two cluster-read-only ones file their report or bundle to the archive.
- **Emergency**: the break-glass runbook restarts the console's workloads under the pre-declared elevated role in [`break_glass.toml`](./break_glass.toml) — AdministratorAccess with an explicit Secrets Manager deny, audited end to end.
- Everything routine runs under scoped per-operation roles in [`permissions/`](./permissions), with OPA [`policies/`](./policies) that block a bad deploy before it applies.

## Sandbox

Deploys to AWS EKS using the [`aws-eks-sandbox`](https://github.com/nuonco/aws-eks-sandbox).

## Resources

Nuon platform documentation: [docs.nuon.co](https://docs.nuon.co/get-started/introduction).

Questions about this app config: the [Nuon Slack community](https://join.slack.com/t/nuon-byoc/shared_invite/zt-46l24847a-4HNYaF7670x3CIrYEBamNQ).
