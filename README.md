# Conduit

Self-hosted data sync: pipelines run in the customer's account and data never
leaves it. Every install gets its own sync engine, source database, and
destination bucket, deployed by Nuon into an AWS account you never need
inbound access to. This repo is the complete Nuon app config that ships it.

## What an install runs

| Piece | What it is |
|-------|------------|
| **Sync engine** | The worker deployment: a scheduled Postgres → S3 copy job with per-run history. The first sync lands within a minute of the worker starting. |
| **Destination bucket + IRSA** | [`components/pulumi`](./components/pulumi): the S3 bucket syncs land in, plus the IAM role only the worker's service account can assume to write to it. |
| **API + UI** | [`components/api`](./components/api), [`components/ui`](./components/ui): read-only status API for pipelines and runs, and the app UI that narrates the install from the inside. |
| **Postgres + seed** | Deployed by the chart with schema and seed data, so a fresh install has pipelines registered on day one. |
| **Certificate + ALB** | [`src/components/certificate`](./src/components/certificate), [`src/components/alb`](./src/components/alb): the public HTTPS endpoint. |
| **Compliance export** | [`components/compliance_export.toml`](./components/compliance_export.toml): a toggleable Enterprise destination, off by default — the per-install entitlement mechanic. |
| **Operations** | [Actions](./actions) (sync heartbeat, debug, pause-pipelines emergency), [runbooks](./runbooks/README.md), [OPA policies](./policies), per-operation [IAM roles](./permissions), and a pre-declared [break-glass role](./break_glass.toml). |
| **App branch + triggers** | [`branch.toml`](./branch.toml), [`triggers.toml`](./triggers.toml): staged fleet rollouts from a git push. |

## Deploy it in your org

Written for your terminal; the same steps work pasted into your coding agent.

```sh
git clone https://github.com/nuonco/kitchen-sink conduit && cd conduit
git checkout ms/theme-conduit
nuon auth login
nuon apps create --name conduit
nuon apps sync --app-id <app-id> --force
```

The clone directory is named `conduit` because `nuon apps create --name` must
match it (or carry `--force`). Sync commands pin `--app-id <id> --force` so they
never inherit whatever app your local CLI state last selected.

Create the first install from the dashboard (or `nuon installs create`, using
[`install-configs/`](./install-configs) as the reference). The install page's
checkmarks track provisioning live; once they're green:

```sh
aws s3 ls s3://conduit-<install-id>/orders/
```

The first sync lands within a minute of the worker starting — that object is
your pipeline writing to your bucket.

Run runbooks from the install's dashboard **Runbooks** tab or through your
agent; `nuon runbooks create-run` has a platform-side bug (fix in flight).

## Sandbox

Deploys to AWS EKS using the [`aws-eks-sandbox`](https://github.com/nuonco/aws-eks-sandbox).

## Resources

Nuon platform [documentation](https://docs.nuon.co/get-started/introduction) ·
[Slack community](https://join.slack.com/t/nuon-byoc/shared_invite/zt-46l24847a-4HNYaF7670x3CIrYEBamNQ)
