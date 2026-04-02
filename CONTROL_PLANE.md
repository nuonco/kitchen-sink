# Kitchen Sink App — Control Plane Guide

This document covers developing, building, deploying, and managing the Kitchen Sink App through the Nuon control plane.

## Overview

The Kitchen Sink App exercises the full breadth of the Nuon platform:

- **Helm chart** deploying API, UI, and Worker to EKS
- **Pulumi component** creating an S3 bucket with encryption and public access blocked
- **Terraform module** creating SSM parameter with resource tags and drift detection
- **Docker build** component for the Worker image
- **Job** component for one-shot seed task
- **Private ECR image** (API) and **public container image** (UI)
- **OPA policies** across all 4 policy types (terraform_module, helm_chart, sandbox, kubernetes_cluster)
- **Custom roles** for sandbox updates, setup, maintenance, and actions
- **Actions** for health checks (cron), debugging (manual), status collection (hourly cron), and lifecycle hooks (all trigger types)
- **Secrets** with auto-generation and Kubernetes sync
- **Inputs** exercising all field types (required, sensitive, internal, user_configurable)
- **Installer** with full branding and markdown configuration
- **Custom nested stacks** in CloudFormation

## Sandbox

Uses [`aws-eks-sandbox`](https://github.com/nuonco/aws-eks-sandbox) to provision an EKS cluster.

## Components

| Component | Type | Source | Description |
|-----------|------|--------|-------------|
| `img_api` | `container_image` | Private ECR | API + Worker image (var_name) |
| `img_ui` | `container_image` | Public ECR | UI / BFF image (var_name) |
| `img_worker` | `docker_build` | `connected_repo` | Worker image built from API Dockerfile |
| `kitchen_sink` | `helm_chart` | `chart/` | API (internal), UI (public), Worker — with operation_roles |
| `pulumi_infra` | `pulumi` | `pulumi/` | S3 bucket with encryption and versioning |
| `terraform_tags` | `terraform_module` | `terraform/` | SSM parameter + tags — drift_schedule, vars, var_file, env_vars |
| `seed_job` | `job` | — | One-shot seed job with cmd/args/env_vars |

## Source Code

- **API** (`api/`) — Go introspection API (Gin). 13 endpoints exposing K8s, Helm, Terraform, and environment data.
- **Worker** (`api/cmd/worker/`) — Background process logging on a 5-second interval.
- **UI** (`ui/`) — React + Vite + TypeScript dashboard. Go BFF serves static files and proxies `/api/*` to the API.
- **Pulumi** (`pulumi/`) — Go Pulumi program creating a private, encrypted, versioned S3 bucket.
- **Terraform** (`terraform/`) — Terraform module creating SSM parameter with resource tags.
- **Helm Chart** (`chart/`) — Deploys API (internal ingress), UI (public ingress), and Worker.

## Actions

| Action | Trigger | Description |
|--------|---------|-------------|
| `healthcheck` | Cron (`*/5 * * * *`) + Manual | Curls API `/readyz` |
| `debug` | Manual | Dumps pods, events, helm releases, and logs |
| `cron_status` | Cron (`0 * * * *`) + Manual | Collects node, pod, service, and ingress status |
| `lifecycle_hooks` | All lifecycle triggers + Manual | Logs hook type, install ID, and timestamp |

### Lifecycle Hook Trigger Types

The `lifecycle_hooks` action exercises every trigger type:
- `manual` — run from dashboard/CLI
- `post-provision` — after install provisioning
- `post-deploy-component` — after `kitchen_sink` deploys
- `pre-deploy-component` — before `kitchen_sink` deploys
- `post-sandbox-run` — after sandbox Terraform runs
- `post-deploy-action` — after `healthcheck` action deploys
- `post-provision-all-components` — after all components deploy

## Roles

| Role | Type | Purpose |
|------|------|---------|
| `provision` | provision | Provision sandbox and components |
| `deprovision` | deprovision | Tear down sandbox and components |
| `sandbox-updates` | custom | Update and maintain sandbox infrastructure |
| `setup` | custom | Initial component deployment |
| `maintenance` | custom | Operate and remediate components |
| `actions` | custom | Execute actions (EKS access only) |

## Policies

| Policy | Type | Engine | Scope |
|--------|------|--------|-------|
| `deny-public-s3-bucket` | `terraform_module` | OPA | All — S3 buckets must block public access |
| `deny-public-api-ingress` | `helm_chart` | OPA | `kitchen_sink` — API must use internal ingress |
| `sandbox-limits` | `sandbox` | OPA | EKS cluster version must be 1.x |
| `cluster-requirements` | `kubernetes_cluster` | OPA | No custom workloads in kube-system namespace |

## Deploy with Nuon

```bash
nuon auth login
nuon apps create --name kitchen-sink
cd nuon && nuon apps sync
```

Then go to the [Nuon dashboard](https://app.nuon.co), select the app, and click "Install".

## Local Development

```bash
# API (port 8080)
cd api && go run .

# Worker
cd api && go run ./cmd/worker

# UI frontend (dev mode, proxies to localhost:8080)
cd ui/frontend && npm install && npm run dev

# UI BFF server (port 3000, proxies to API)
cd ui && go run .
```

## Docker

```bash
docker build -t kitchen-sink-api api/
docker build -t kitchen-sink-ui ui/
```

## Push to Private ECR

The script creates the ECR repo and Nuon pull access IAM role if they don't exist.

```bash
# Defaults: us-west-2, repo=kitchen-sink-app
./scripts/push-to-ecr.sh --tag v0.0.1

# With a specific profile and region
./scripts/push-to-ecr.sh --profile my-profile --region eu-west-1 --tag v0.0.1
```

## Resources

- [Nuon Docs](https://docs.nuon.co)
- [AWS EKS Sandbox](https://github.com/nuonco/aws-eks-sandbox)
- [Nuon ECR Access Terraform Module](https://registry.terraform.io/modules/nuonco/ecr-access/aws)
- [Example App Configs](https://github.com/nuonco/example-app-configs)
