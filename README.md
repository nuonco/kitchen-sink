# Kitchen Sink

A test application showcasing all features of the Nuon platform including Helm charts, Pulumi infrastructure, container images, actions, roles, and policies.

## What Gets Deployed

| Feature | Description |
|---------|-------------|
| **Helm Chart** | Deploys API, UI, and Worker pods to EKS |
| **Pulumi Infrastructure** | Creates an S3 bucket with encryption and versioning |
| **Container Images** | Pre-built images from private ECR |
| **Actions** | Health checks, debugging, lifecycle hooks, break-glass demos — see [`actions/`](./actions/README.md) |
| **Policies** | OPA policies for security and compliance |
| **Runbooks** | Multi-step operational procedures — see [`runbooks/`](./runbooks/README.md) |
| **Component Health** | Live per-component health with probes — `[health]` in `components/chart/nuon.toml` and `components/alb.toml` |
| **App Branch** | Staged fleet rollouts from a git push — [`branch.toml`](./branch.toml) |
| **Triggers** | External events that start a rollout — opt-in, see [`triggers.toml.example`](./triggers.toml.example) |

## Sandbox

Deploys to AWS EKS using the [`aws-eks-sandbox`](https://github.com/nuonco/aws-eks-sandbox).

## Resources

For more information on Nuon platform features, see the [documentation](https://docs.nuon.co/get-started/introduction).

For questions or support with this app config, reach out to us in our [Slack community](https://join.slack.com/t/nuon-byoc/shared_invite/zt-46l24847a-4HNYaF7670x3CIrYEBamNQ).

<!-- sync test 2026-08-14 -->
