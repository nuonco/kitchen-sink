"""
Kitchen Sink E2E API - Python Port

This API provides introspection endpoints for testing Nuon deployments.
Ported from the Go version in mono/services/e2e/api.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Any, Optional

from introspection import kube, helm, env

app = FastAPI(
    title="Kitchen Sink E2E API",
    description="Introspection API for testing Nuon deployments",
    version="1.0.0"
)


# Response models
class Endpoint(BaseModel):
    path: str
    description: str


class DiscoverResponse(BaseModel):
    description: str
    endpoints: List[Endpoint]


class HealthResponse(BaseModel):
    status: str


class IntrospectResponse(BaseModel):
    description: str
    response: Any


class ErrorResponse(BaseModel):
    description: str
    err: str


# Endpoint descriptions (matching Go constants)
KUBE_DESCRIPTION = "Returns all namespaces in the cluster"
KUBE_NAMESPACE_DESCRIPTION = "Returns details for a specific namespace (pods, services, secrets)"
HELM_DESCRIPTION = "Returns all helm releases"
HELM_VALUES_DESCRIPTION = "Returns helm chart values for a specific release"
HELM_RENDERED_DESCRIPTION = "Returns rendered helm manifests for a specific release"
ENV_DESCRIPTION = "Returns all environment variables"
TERRAFORM_DESCRIPTION = "Returns TERRAFORM_* environment variables"
SECRETS_DESCRIPTION = "Returns SECRET* environment variables"
DEFAULTS_DESCRIPTION = "Returns DEFAULT* environment variables"
SANDBOX_DESCRIPTION = "Returns SANDBOX* environment variables"
NUON_DESCRIPTION = "Returns NUON* environment variables"
DOCKER_BUILD_DESCRIPTION = "Returns DOCKER_BUILD* environment variables"
EXTERNAL_IMAGE_DESCRIPTION = "Returns EXTERNAL_IMAGE* environment variables"


@app.get("/", response_model=DiscoverResponse)
def discover():
    """Discovery endpoint - lists all available endpoints."""
    return DiscoverResponse(
        description="This API exposes introspection details of a Nuon app running in a customer's cloud account.",
        endpoints=[
            Endpoint(path="/introspect/kube", description=KUBE_DESCRIPTION),
            Endpoint(path="/introspect/namespace/{namespace}", description=KUBE_NAMESPACE_DESCRIPTION),
            Endpoint(path="/introspect/helm", description=HELM_DESCRIPTION),
            Endpoint(path="/introspect/helm-values/{namespace}/{name}", description=HELM_VALUES_DESCRIPTION),
            Endpoint(path="/introspect/helm-rendered/{namespace}/{name}", description=HELM_RENDERED_DESCRIPTION),
            Endpoint(path="/introspect/env", description=ENV_DESCRIPTION),
            Endpoint(path="/introspect/terraform", description=TERRAFORM_DESCRIPTION),
            Endpoint(path="/introspect/secrets", description=SECRETS_DESCRIPTION),
            Endpoint(path="/introspect/defaults", description=DEFAULTS_DESCRIPTION),
            Endpoint(path="/introspect/sandbox", description=SANDBOX_DESCRIPTION),
            Endpoint(path="/introspect/nuon", description=NUON_DESCRIPTION),
            Endpoint(path="/introspect/docker-build", description=DOCKER_BUILD_DESCRIPTION),
            Endpoint(path="/introspect/external-image", description=EXTERNAL_IMAGE_DESCRIPTION),
            Endpoint(path="/livez", description="/livez check"),
            Endpoint(path="/readyz", description="/readyz check"),
        ]
    )


@app.get("/livez", response_model=HealthResponse)
def livez():
    """Liveness probe - indicates the service is running."""
    return HealthResponse(status="ok")


@app.get("/readyz", response_model=HealthResponse)
def readyz():
    """Readiness probe - indicates the service is ready to accept traffic."""
    return HealthResponse(status="ok")


# =============================================================================
# K8s Introspection Endpoints (Step 3)
# =============================================================================

@app.get("/introspect/kube", response_model=IntrospectResponse)
def introspect_kube():
    """Returns all namespaces in the cluster."""
    try:
        result = kube.get_namespaces()
        return IntrospectResponse(
            description=KUBE_DESCRIPTION,
            response=result
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail={
            "description": KUBE_DESCRIPTION,
            "err": str(e)
        })


@app.get("/introspect/namespace/{namespace}", response_model=IntrospectResponse)
def introspect_namespace(namespace: str):
    """Returns details for a specific namespace (pods, services, secrets)."""
    try:
        result = kube.get_namespace_details(namespace)
        return IntrospectResponse(
            description=KUBE_NAMESPACE_DESCRIPTION,
            response=result
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail={
            "description": KUBE_NAMESPACE_DESCRIPTION,
            "err": str(e)
        })


# =============================================================================
# Helm Introspection Endpoints (Step 4)
# =============================================================================

@app.get("/introspect/helm", response_model=IntrospectResponse)
def introspect_helm():
    """Returns all helm releases across all namespaces."""
    try:
        result = helm.get_all_releases()
        return IntrospectResponse(
            description=HELM_DESCRIPTION,
            response=result
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail={
            "description": HELM_DESCRIPTION,
            "err": str(e)
        })


@app.get("/introspect/helm-values/{namespace}/{name}", response_model=IntrospectResponse)
def introspect_helm_values(namespace: str, name: str):
    """Returns the values for a specific helm release."""
    try:
        result = helm.get_helm_values(namespace, name)
        return IntrospectResponse(
            description=HELM_VALUES_DESCRIPTION,
            response=result
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail={
            "description": HELM_VALUES_DESCRIPTION,
            "err": str(e)
        })


@app.get("/introspect/helm-rendered/{namespace}/{name}")
def introspect_helm_rendered(namespace: str, name: str):
    """Returns the rendered manifests for a helm release."""
    try:
        result = helm.get_helm_rendered(namespace, name)
        return result  # Returns plain text YAML
    except Exception as e:
        raise HTTPException(status_code=400, detail={
            "description": HELM_RENDERED_DESCRIPTION,
            "err": str(e)
        })


# =============================================================================
# Env Introspection Endpoints (Step 5)
# =============================================================================

@app.get("/introspect/env", response_model=IntrospectResponse)
def introspect_env():
    """Returns all environment variables."""
    return IntrospectResponse(
        description=ENV_DESCRIPTION,
        response=env.get_all_env()
    )


@app.get("/introspect/terraform", response_model=IntrospectResponse)
def introspect_terraform():
    """Returns TERRAFORM_* environment variables."""
    return IntrospectResponse(
        description=TERRAFORM_DESCRIPTION,
        response=env.get_terraform_env()
    )


@app.get("/introspect/secrets", response_model=IntrospectResponse)
def introspect_secrets():
    """Returns SECRET* environment variables."""
    return IntrospectResponse(
        description=SECRETS_DESCRIPTION,
        response=env.get_secrets_env()
    )


@app.get("/introspect/defaults", response_model=IntrospectResponse)
def introspect_defaults():
    """Returns DEFAULT* environment variables."""
    return IntrospectResponse(
        description=DEFAULTS_DESCRIPTION,
        response=env.get_defaults_env()
    )


@app.get("/introspect/sandbox", response_model=IntrospectResponse)
def introspect_sandbox():
    """Returns SANDBOX* environment variables."""
    return IntrospectResponse(
        description=SANDBOX_DESCRIPTION,
        response=env.get_sandbox_env()
    )


@app.get("/introspect/nuon", response_model=IntrospectResponse)
def introspect_nuon():
    """Returns NUON* environment variables."""
    return IntrospectResponse(
        description=NUON_DESCRIPTION,
        response=env.get_nuon_env()
    )


@app.get("/introspect/docker-build", response_model=IntrospectResponse)
def introspect_docker_build():
    """Returns DOCKER_BUILD* environment variables."""
    return IntrospectResponse(
        description=DOCKER_BUILD_DESCRIPTION,
        response=env.get_docker_build_env()
    )


@app.get("/introspect/external-image", response_model=IntrospectResponse)
def introspect_external_image():
    """Returns EXTERNAL_IMAGE* environment variables."""
    return IntrospectResponse(
        description=EXTERNAL_IMAGE_DESCRIPTION,
        response=env.get_external_image_env()
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
