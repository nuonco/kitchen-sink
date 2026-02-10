"""
Kubernetes introspection handlers.
Ported from mono/services/e2e/api/internal/introspection/kube.go and namespace.go
"""

from typing import Any, Dict, List
from kubernetes import client, config
from kubernetes.client.exceptions import ApiException


def get_kube_client():
    """Get Kubernetes client, trying in-cluster config first, then local kubeconfig."""
    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()
    return client.CoreV1Api()


def get_namespaces() -> Dict[str, Any]:
    """
    Returns all namespaces in the cluster.
    GET /introspect/kube
    """
    try:
        v1 = get_kube_client()
        namespaces = v1.list_namespace()
        
        result = []
        for ns in namespaces.items:
            result.append({
                "name": ns.metadata.name,
                "status": {
                    "phase": ns.status.phase
                }
            })
        
        return {"namespaces": result}
    except ApiException as e:
        raise Exception(f"Unable to get namespaces: {e.reason}")
    except Exception as e:
        raise Exception(f"Unable to get kube config: {str(e)}")


def get_namespace_details(namespace: str) -> Dict[str, Any]:
    """
    Returns details for a specific namespace (pods, services, secrets).
    GET /introspect/namespace/{namespace}
    """
    try:
        v1 = get_kube_client()
        
        # Get secrets
        secrets = v1.list_namespaced_secret(namespace)
        secrets_list = [
            {
                "name": s.metadata.name,
                "type": s.type,
                "created": s.metadata.creation_timestamp.isoformat() if s.metadata.creation_timestamp else None
            }
            for s in secrets.items
        ]
        
        # Get services
        services = v1.list_namespaced_service(namespace)
        services_list = [
            {
                "name": svc.metadata.name,
                "type": svc.spec.type,
                "cluster_ip": svc.spec.cluster_ip,
                "ports": [
                    {"port": p.port, "target_port": str(p.target_port), "protocol": p.protocol}
                    for p in (svc.spec.ports or [])
                ]
            }
            for svc in services.items
        ]
        
        # Get pods
        pods = v1.list_namespaced_pod(namespace)
        pods_list = [
            {
                "name": p.metadata.name,
                "phase": p.status.phase,
                "ready": all(
                    c.ready for c in (p.status.container_statuses or [])
                ) if p.status.container_statuses else False
            }
            for p in pods.items
        ]
        
        return {
            "name": namespace,
            "secrets_count": len(secrets_list),
            "secrets": secrets_list,
            "services_count": len(services_list),
            "services": services_list,
            "pods_count": len(pods_list),
            "pods": pods_list
        }
    except ApiException as e:
        raise Exception(f"Unable to get namespace details: {e.reason}")
    except Exception as e:
        raise Exception(f"Unable to get kube config: {str(e)}")
