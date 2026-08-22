# Relay

Self-hosted webhook delivery, deployed by Nuon into your own AWS account: an
ingest API, a Postgres-backed queue, and a delivery worker with retries,
backoff, and a dead-letter queue. An in-cluster echo receiver ships as the
seeded destination, and a generator CronJob feeds real events through the
pipeline every two minutes — every delivery is a real HTTP request. This repo
is the entire app definition; Nuon builds and runs it.

## Deploy it

You need the [Nuon CLI](https://docs.nuon.co/get-started/introduction)
authenticated against your org, and an AWS account to install into.

```sh
git clone https://github.com/nuonco/kitchen-sink.git relay
cd relay
nuon apps create --name relay
nuon sync --app-id relay --force
```

Two CLI behaviors the commands above already handle:

- The CLI checks the app name against the clone directory's basename. Clone
  into `relay` (as above) or pass `--force` to skip the check.
- `nuon sync` targets whichever app your CLI last selected — not the current
  directory. Always pin `--app-id`.

Then create an install from the [dashboard](https://app.nuon.co): pick an AWS
account and region, and Nuon provisions the EKS sandbox, builds the
components, and deploys them in dependency order. The install page renders
[`control-plane.md`](./control-plane.md) against live state while it happens.

## What you'll see

Open the console at `https://app.<install domain>`. Seed data gives you two
endpoints (`relay-echo`, active, plus an inactive external example) and a
delivered history. From there the CronJob generates events every two minutes,
the worker delivers each one to the echo receiver, and failures retry with
backoff until they land in the DLQ — where you can replay them.

## Repo layout → Nuon concepts

| Path | Nuon concept | Role in Relay |
|---|---|---|
| `components/` | Components | One Go binary (`components/api`, modes `api`/`worker`/`echo`/`generate`), the console (`components/ui`), the Helm chart that runs them plus Postgres and the generator, the ALB + certificate, and an S3 bucket for archived delivery logs (`components/pulumi`) |
| `branch.toml` | App branch | Staged rollouts: every push to the tracked branch rolls out staging → customers → enterprise, with approval holds |
| `triggers.toml` | Triggers | Turns git pushes and install lifecycle events into runs |
| `components/tictactoe.toml`, `components/audit_log_exporter.toml` | Toggles | Per-install entitlements the console detects at runtime |
| `runbooks/` | Runbooks | Delivery-pipeline SOPs — [`full-health-check`](./runbooks/full-health-check.md), the [`break-glass`](./runbooks/break-glass.md) DLQ drain, and more |
| `actions/` | Actions | Runner-side jobs: the hourly `cron_status` heartbeat, `delivery_log_export` (stats + events + DLQ to S3 every six hours), break-glass remediation |
| `permissions/`, `policies/`, `break_glass.toml` | Roles & policies | A scoped IAM role per operation, OPA deploy gates, and a pre-agreed emergency role |
| `inputs/`, `input_groups/`, `secrets.toml` | Inputs & secrets | Per-install parameters; the Postgres password is a synced secret, never in git |
| `installs.toml` | Installs & groups | Install definitions and the labels the rollout groups select on |
| `sandbox.toml`, `stack.toml`, `runner.toml` | Sandbox & runner | The EKS/VPC foundation ([`aws-eks-sandbox`](https://github.com/nuonco/aws-eks-sandbox)) and the in-account runner that performs every build, deploy, and action |

## Resources

[Nuon documentation](https://docs.nuon.co/get-started/introduction) ·
[Slack community](https://join.slack.com/t/nuon-byoc/shared_invite/zt-46l24847a-4HNYaF7670x3CIrYEBamNQ)
