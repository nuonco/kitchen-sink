# Kitchen Sink

Nuon's demo app config: a real web app (UI, API, and worker) plus the platform
surface around it. Nuon deploys the whole thing into an AWS account as a
[BYOC install](https://docs.nuon.co/get-started/introduction), and the UI it
ships is a guided tour of that install from the inside, served at
`https://app.<install domain>`.

## How it ships

| | |
|---|---|
| **App branch** | Everything ships through [`branch.toml`](./branch.toml): a push to `main` rolls the config out group by group (staging, then customers, then enterprise) with a person approving each group's plan. Try it end to end in the [app-branches walkthrough](https://docs.nuon.co/get-started/app-branches-walkthrough). |
| **Your coding agent** | `nuon agents mcp setup --platform claude-code` connects Nuon's MCP server to Claude Code (or `cursor`, `amp`) through the CLI; `nuon agents context` verifies it. The deployed UI's agent page has ten prompts, ids filled in. Docs: [agents overview](https://docs.nuon.co/guides/agents/overview). A project [`.mcp.json`](./.mcp.json) is checked in, so a clone of this repo offers the server on first open. |

## What gets deployed

| Feature | Description |
|---------|-------------|
| **Helm chart** | Deploys the API, UI, and worker pods to EKS |
| **Pulumi infrastructure** | Creates an S3 bucket with encryption and versioning |
| **Container images** | Pre-built images from public registries, so the config builds in any org |
| **Actions** | Script and container-based health checks, debugging, DNS gates, and lifecycle hooks |
| **Runbooks** | Multi-step operational procedures — see [`runbooks/`](./runbooks/README.md) |
| **Component health** | Live per-component health with probes — `[health]` in `components/chart/nuon.toml` and `components/alb.toml` |
| **Triggers** | External events that start a rollout — opt-in, see [`triggers.toml.example`](./triggers.toml.example) |
| **Toggleable components** | Per-install entitlements — flip a component on and Nuon deploys it there; off, and it is torn down |
| **IAM roles & policies** | One scoped role per operation ([`permissions/`](./permissions/)), a break-glass role with an explicit Secrets Manager deny ([`break_glass.toml`](./break_glass.toml)), and OPA policies evaluated against plans |

## Sandbox

Deploys to AWS EKS using the [`aws-eks-sandbox`](https://github.com/nuonco/aws-eks-sandbox).

## Resources

The [Nuon docs](https://docs.nuon.co/get-started/introduction) cover every
feature this app demonstrates.

For questions or support with this app config, reach out in the
[Nuon Slack community](https://join.slack.com/t/nuon-byoc/shared_invite/zt-46l24847a-4HNYaF7670x3CIrYEBamNQ).
