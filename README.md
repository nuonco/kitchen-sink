# Kitchen Sink App

The Kitchen Sink App is a comprehensive test application designed to exercise and showcase the full breadth of the [Nuon](https://nuon.co) platform. It deploys an API, UI, worker, and supporting infrastructure into a customer's AWS cloud account.

This app serves as a testbed for every major Nuon feature: Helm charts, Pulumi components, container images (public and private ECR), OPA policies, custom roles, actions (manual, cron, and post-deploy), and more.

## Sandbox

This application uses the [`aws-eks-sandbox`](https://github.com/nuonco/aws-eks-sandbox). Sandboxes are Terraform that install your app's underlying infrastructure like AWS EKS. Learn more about [sandboxes](https://docs.nuon.co/concepts/sandboxes).

## Architecture

```mermaid
graph TD

    subgraph Nuon["Nuon Control Plane"]
        NuonAPI["Nuon API"]
    end

    subgraph Clients["Clients"]
        Browser["Web Browser"]
    end

    subgraph VPC["Customer Cloud VPC (AWS)"]
        Runner["Nuon Runner"]
        Stack["CloudFormation Stack"]
        S3["S3 Bucket (Pulumi)"]

        subgraph EKS["EKS Cluster"]
            UI["UI / BFF"]
            API["Introspection API"]
            Worker["Background Worker"]
        end
    end

    NuonAPI -->|generates| Stack
    Stack -->|provisions| Runner
    Runner -->|provisions| EKS
    Runner -->|provisions| S3
    Runner -->|deploys| UI
    Runner -->|deploys| API
    Runner -->|deploys| Worker

    UI -->|proxies /api/*| API
    Browser -->|HTTPS (public)| UI
```

## Components

| Component | Type | Source | Description |
|-----------|------|--------|-------------|
| `img_api` | `container_image` | Private ECR | API + Worker image (private) |
| `img_ui` | `container_image` | Public ECR | UI / BFF image (public) |
| `kitchen_sink` | `helm_chart` | `chart/` | Deploys API, UI, and Worker to EKS |
| `pulumi_infra` | `pulumi` | `pulumi/` | S3 bucket with encryption, versioning, and public access block |

### Source Code

- **API** (`api/`) - Go introspection API (Gin framework) exposing Kubernetes, Helm, Terraform, and environment data. 13 introspection endpoints plus health probes.
- **Worker** (`api/cmd/worker/`) - Background worker process logging on a 5-second interval.
- **UI** (`ui/`) - React (Vite + TypeScript) dashboard with a Go backend-for-frontend that serves static files and proxies `/api/*` to the API service.
- **Pulumi** (`pulumi/`) - Go Pulumi program creating an S3 bucket with encryption, versioning, and public access blocked.
- **Helm Chart** (`chart/`) - Kubernetes deployment chart for API (internal ingress), UI (public ingress), and Worker.

## Actions

| Action | Trigger | Description |
|--------|---------|-------------|
| `healthcheck` | Cron (every 5 min) + Manual | Curls the API `/readyz` endpoint |
| `debug` | Manual | Dumps pods, events, helm releases, and logs |
| `cron_status` | Cron (hourly) + Manual | Collects node, pod, service, and ingress status |

## Roles

| Role | Type | Purpose |
|------|------|---------|
| `provision` | provision | Provision sandbox and components |
| `deprovision` | deprovision | Tear down sandbox and components |
| `sandbox-updates` | custom | Update and maintain sandbox infrastructure |
| `setup` | custom | Initial component deployment and configuration |
| `maintenance` | custom | Operate and remediate components |
| `actions` | custom | Execute actions (EKS access only) |

## Policies

| Policy | Type | Engine | Scope |
|--------|------|--------|-------|
| `deny-public-s3-bucket` | terraform_module | OPA | All components - blocks public S3 buckets |
| `deny-public-api-ingress` | helm_chart | OPA | `kitchen_sink` - API must use internal ingress |

## Getting Started

### Prerequisites

- [Nuon CLI](https://docs.nuon.co/cli) installed
- AWS account with Nuon access configured

### Deploy

```bash
nuon auth login
nuon apps create --name kitchen-sink
cd nuon && nuon apps sync
```

Then go to the [Nuon dashboard](https://app.nuon.co), select the app, and click "Install".

### Local Development

```bash
# API (port 8080)
cd api && go run .

# Worker
cd api && go run ./cmd/worker

# UI frontend (dev mode with hot reload, proxies to API)
cd ui/frontend && npm install && npm run dev

# UI BFF server (port 3000, proxies to API)
cd ui && go run .
```

### Docker

```bash
docker build -t kitchen-sink-api api/
docker build -t kitchen-sink-ui ui/
```

### Push to Private ECR

```bash
IMAGE_TAG=v0.0.1 ./scripts/push-to-ecr.sh
```

## Documentation

- [Nuon Docs](https://docs.nuon.co)
- [AWS EKS Sandbox](https://github.com/nuonco/aws-eks-sandbox)
- [Example App Configs](https://github.com/nuonco/example-app-configs)
