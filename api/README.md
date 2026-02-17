# Kitchen Sink E2E API

Python port of the E2E introspection API for testing Nuon deployments.

## Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Run locally
uvicorn main:app --reload --port 8080
```

## Docker

```bash
# Build
docker build -t kitchen-sink-api .

# Run
docker run -p 8080:8080 kitchen-sink-api
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Discovery endpoint |
| GET | `/livez` | Liveness probe |
| GET | `/readyz` | Readiness probe |
| GET | `/introspect/kube` | K8s cluster namespaces |
| GET | `/introspect/namespace/{namespace}` | Namespace details |
| GET | `/introspect/helm` | All helm releases |
| GET | `/introspect/helm-values/{namespace}/{name}` | Helm chart values |
| GET | `/introspect/helm-rendered/{namespace}/{name}` | Rendered helm manifests |
| GET | `/introspect/env` | Full environment |
| GET | `/introspect/terraform` | TERRAFORM_* env vars |
| GET | `/introspect/secrets` | SECRET* env vars |
| GET | `/introspect/defaults` | DEFAULT* env vars |
| GET | `/introspect/sandbox` | SANDBOX* env vars |
| GET | `/introspect/nuon` | NUON* env vars |
| GET | `/introspect/docker-build` | DOCKER_BUILD* env vars |
| GET | `/introspect/external-image` | EXTERNAL_IMAGE* env vars |
