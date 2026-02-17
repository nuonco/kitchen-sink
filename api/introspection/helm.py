"""
Helm introspection handlers.
Ported from mono/services/e2e/api/internal/introspection/helm*.go

Uses subprocess to call helm CLI since there's no mature Python Helm library.
"""

import subprocess
import json
from typing import Any, Dict, Optional


def run_helm_command(args: list) -> str:
    """Run a helm command and return the output."""
    try:
        result = subprocess.run(
            ["helm"] + args,
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode != 0:
            raise Exception(f"Helm command failed: {result.stderr}")
        return result.stdout
    except FileNotFoundError:
        raise Exception("Helm CLI not found. Ensure helm is installed.")
    except subprocess.TimeoutExpired:
        raise Exception("Helm command timed out")


def get_all_releases() -> Dict[str, Any]:
    """
    Returns all helm releases across all namespaces.
    GET /introspect/helm
    """
    try:
        output = run_helm_command(["list", "--all-namespaces", "--output", "json"])
        releases = json.loads(output) if output.strip() else []
        
        charts = {}
        for release in releases:
            key = f"{release.get('namespace', '')}.{release.get('name', '')}"
            charts[key] = {
                "name": release.get("name"),
                "namespace": release.get("namespace"),
                "revision": release.get("revision"),
                "status": release.get("status"),
                "chart": release.get("chart"),
                "app_version": release.get("app_version"),
                "updated": release.get("updated")
            }
        
        return {"charts": charts}
    except Exception as e:
        raise Exception(f"Unable to get helm releases: {str(e)}")


def get_helm_values(namespace: str, name: str) -> Dict[str, Any]:
    """
    Returns the values for a specific helm release.
    GET /introspect/helm-values/{namespace}/{name}
    """
    try:
        output = run_helm_command([
            "get", "values", name,
            "--namespace", namespace,
            "--all",
            "--output", "json"
        ])
        values = json.loads(output) if output.strip() else {}
        return values
    except Exception as e:
        raise Exception(f"Unable to get helm values: {str(e)}")


def get_helm_rendered(namespace: str, name: str) -> str:
    """
    Returns the rendered manifests for a helm release.
    GET /introspect/helm-rendered/{namespace}/{name}
    """
    try:
        output = run_helm_command([
            "get", "manifest", name,
            "--namespace", namespace
        ])
        return output
    except Exception as e:
        raise Exception(f"Unable to get helm manifests: {str(e)}")
