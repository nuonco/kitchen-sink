# Kitchen Sink

A comprehensive Nuon example app that demonstrates all component types, features, and deployment patterns.

## Overview

This app is a complete v2 TOML-based Nuon configuration that includes:

- **All component types**: Helm chart, Docker build, Terraform module, container images, jobs
- **Full lifecycle hooks**: Pre/post provision, deploy, deprovision, reprovision
- **Security features**: Break glass roles, permissions, policies
- **Secrets management**: Auto-generated and required secrets with K8s sync
- **Drift detection**: Scheduled drift checks on sandbox and helm components
- **CloudFormation stack**: One-click install onboarding for customers

## Project Structure

```
kitchen-sink/
├── metadata.toml          # App metadata
├── runner.toml            # Runner configuration
├── sandbox.toml           # Sandbox/infrastructure config
├── inputs.toml            # User inputs (2 groups, 3 inputs)
├── installer.toml         # Installer UI configuration
├── policies.toml          # Kyverno and Terraform policies
├── break_glass.toml       # Emergency access IAM roles
├── permissions.toml       # Provision/deprovision/maintenance roles
├── secrets.toml           # Secrets with K8s sync
├── stack.toml             # CloudFormation onboarding stack
├── docker-compose.yml     # Local development
├── components/            # All component types
│   ├── helm_chart.toml
│   ├── docker_build.toml
│   ├── terraform_module.toml
│   ├── container_image.toml
│   ├── ecr_image.toml
│   └── job.toml
├── installs/              # Install configurations
│   └── dev.toml
├── actions/               # Lifecycle hooks
│   ├── pre_provision.toml
│   ├── post_provision.toml
│   ├── pre_deploy_component.toml
│   ├── post_deploy_all_components.toml
│   ├── pre_deprovision.toml
│   ├── pre_reprovision.toml
│   └── manual.toml
├── policies/              # Policy definitions
│   ├── require_tags.yml
│   └── disallow-ingress-nginx-custom-snippets.yml
├── api/                   # Python E2E API
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── introspection/
└── worker/                # Python worker (no-op)
    ├── main.py
    └── Dockerfile
```

## Local Development

### Run with Docker Compose

```bash
docker-compose up --build
```

Services:
- API: http://localhost:8080
- API Docs: http://localhost:8080/docs (FastAPI auto-generated)

### Run API Locally

```bash
cd api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

### Run Worker Locally

```bash
cd worker
python main.py
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Discovery endpoint |
| GET | `/livez` | Liveness probe |
| GET | `/readyz` | Readiness probe |
| GET | `/introspect/kube` | K8s cluster namespaces |
| GET | `/introspect/namespace/{namespace}` | Namespace details |
| GET | `/introspect/helm` | All helm releases |
| GET | `/introspect/helm-values/{namespace}/{name}` | Helm chart values |
| GET | `/introspect/helm-rendered/{namespace}/{name}` | Rendered manifests |
| GET | `/introspect/env` | All environment variables |
| GET | `/introspect/terraform` | TERRAFORM_* env vars |
| GET | `/introspect/secrets` | SECRET* env vars |
| GET | `/introspect/defaults` | DEFAULT* env vars |
| GET | `/introspect/sandbox` | SANDBOX* env vars |
| GET | `/introspect/nuon` | NUON* env vars |
| GET | `/introspect/docker-build` | DOCKER_BUILD* env vars |
| GET | `/introspect/external-image` | EXTERNAL_IMAGE* env vars |

## Deploy with Nuon

```bash
# Sync the app configuration
nuon apps sync

# Create an install
nuon installs create --name my-install
```

## License

Internal Nuon use.
