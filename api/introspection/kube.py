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


def get_cluster_metrics() -> Dict[str, Any]:
    """
    Returns cluster-wide metrics (nodes, pods, CPU, memory).
    GET /introspect/metrics
    
    Requires Metrics Server to be installed in the cluster.
    """
    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()
    
    v1 = client.CoreV1Api()
    custom_api = client.CustomObjectsApi()
    
    # Get node count
    nodes = v1.list_node()
    node_count = len(nodes.items)
    nodes_ready = sum(
        1 for n in nodes.items
        if any(c.type == "Ready" and c.status == "True" for c in n.status.conditions)
    )
    
    # Get pod count
    pods = v1.list_pod_for_all_namespaces()
    pod_count = len(pods.items)
    pods_running = sum(1 for p in pods.items if p.status.phase == "Running")
    
    # Try to get metrics from Metrics Server
    cpu_usage = None
    memory_usage = None
    cpu_capacity = "N/A"
    memory_capacity = "N/A"
    
    try:
        node_metrics = custom_api.list_cluster_custom_object(
            group="metrics.k8s.io",
            version="v1beta1",
            plural="nodes"
        )
        
        total_cpu_usage = 0
        total_cpu_capacity = 0
        total_mem_usage = 0
        total_mem_capacity = 0
        
        for item in node_metrics.get("items", []):
            cpu_str = item.get("usage", {}).get("cpu", "0")
            mem_str = item.get("usage", {}).get("memory", "0")
            
            # Parse CPU (usually in nanocores like "250m" or "1000000000n")
            if cpu_str.endswith("n"):
                total_cpu_usage += int(cpu_str[:-1]) / 1_000_000_000
            elif cpu_str.endswith("m"):
                total_cpu_usage += int(cpu_str[:-1]) / 1000
            else:
                total_cpu_usage += float(cpu_str)
            
            # Parse Memory (usually in Ki, Mi, Gi)
            if mem_str.endswith("Ki"):
                total_mem_usage += int(mem_str[:-2]) * 1024
            elif mem_str.endswith("Mi"):
                total_mem_usage += int(mem_str[:-2]) * 1024 * 1024
            elif mem_str.endswith("Gi"):
                total_mem_usage += int(mem_str[:-2]) * 1024 * 1024 * 1024
            else:
                total_mem_usage += int(mem_str)
        
        # Get capacity from nodes
        for n in nodes.items:
            cpu_cap = n.status.capacity.get("cpu", "0")
            mem_cap = n.status.capacity.get("memory", "0")
            
            # Parse CPU capacity
            if cpu_cap.endswith("m"):
                total_cpu_capacity += int(cpu_cap[:-1]) / 1000
            else:
                total_cpu_capacity += float(cpu_cap)
            
            # Parse memory capacity
            if mem_cap.endswith("Ki"):
                total_mem_capacity += int(mem_cap[:-2]) * 1024
            elif mem_cap.endswith("Mi"):
                total_mem_capacity += int(mem_cap[:-2]) * 1024 * 1024
            elif mem_cap.endswith("Gi"):
                total_mem_capacity += int(mem_cap[:-2]) * 1024 * 1024 * 1024
            else:
                total_mem_capacity += int(mem_cap.replace("Ki", "").replace("Mi", "").replace("Gi", "") or 0)
        
        if total_cpu_capacity > 0:
            cpu_usage = round((total_cpu_usage / total_cpu_capacity) * 100, 1)
            cpu_capacity = f"{total_cpu_capacity:.1f} cores"
        
        if total_mem_capacity > 0:
            memory_usage = round((total_mem_usage / total_mem_capacity) * 100, 1)
            memory_capacity = f"{total_mem_capacity / (1024**3):.1f} Gi"
            
    except ApiException:
        pass  # Metrics Server not available
    except Exception:
        pass  # Metrics Server not available
    
    return {
        "nodes": node_count,
        "nodes_ready": nodes_ready,
        "pods": pod_count,
        "pods_running": pods_running,
        "cpu_usage": cpu_usage,
        "cpu_capacity": cpu_capacity,
        "memory_usage": memory_usage,
        "memory_capacity": memory_capacity,
        "metrics_available": cpu_usage is not None
    }


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
