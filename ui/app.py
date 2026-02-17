"""
Kitchen Sink Dashboard UI

Flask application that provides a web UI for the Kitchen Sink introspection API.
"""

import os
import requests
from flask import Flask, render_template, jsonify

app = Flask(__name__)

# API base URL - defaults to localhost for development, uses env var in production
API_BASE_URL = os.environ.get("API_URL", "http://localhost:8080")


def api_get(endpoint: str) -> dict:
    """Make a GET request to the introspection API."""
    try:
        response = requests.get(f"{API_BASE_URL}{endpoint}", timeout=10)
        response.raise_for_status()
        return {"success": True, "data": response.json()}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": str(e)}


# =============================================================================
# Page Routes
# =============================================================================

@app.route("/")
def index():
    """Redirect to cluster monitoring."""
    return render_template("cluster.html", active="cluster")


@app.route("/cluster")
def cluster():
    """Cluster monitoring view."""
    return render_template("cluster.html", active="cluster")


@app.route("/deployments")
def deployments():
    """Deployments view."""
    return render_template("deployments.html", active="deployments")


@app.route("/logs")
def logs():
    """Log viewer."""
    return render_template("logs.html", active="logs")


@app.route("/resources")
def resources():
    """Resources view."""
    return render_template("resources.html", active="resources")


# =============================================================================
# API Proxy Routes (for frontend AJAX calls)
# =============================================================================

@app.route("/api/kube")
def api_kube():
    """Proxy to /introspect/kube."""
    return jsonify(api_get("/introspect/kube"))


@app.route("/api/namespace/<namespace>")
def api_namespace(namespace: str):
    """Proxy to /introspect/namespace/{namespace}."""
    return jsonify(api_get(f"/introspect/namespace/{namespace}"))


@app.route("/api/metrics")
def api_metrics():
    """Proxy to /introspect/metrics."""
    return jsonify(api_get("/introspect/metrics"))


@app.route("/api/helm")
def api_helm():
    """Proxy to /introspect/helm."""
    return jsonify(api_get("/introspect/helm"))


@app.route("/api/helm-values/<namespace>/<name>")
def api_helm_values(namespace: str, name: str):
    """Proxy to /introspect/helm-values/{namespace}/{name}."""
    return jsonify(api_get(f"/introspect/helm-values/{namespace}/{name}"))


@app.route("/api/env")
def api_env():
    """Proxy to /introspect/env."""
    return jsonify(api_get("/introspect/env"))


@app.route("/api/terraform")
def api_terraform():
    """Proxy to /introspect/terraform."""
    return jsonify(api_get("/introspect/terraform"))


@app.route("/api/sandbox")
def api_sandbox():
    """Proxy to /introspect/sandbox."""
    return jsonify(api_get("/introspect/sandbox"))


@app.route("/api/nuon")
def api_nuon():
    """Proxy to /introspect/nuon."""
    return jsonify(api_get("/introspect/nuon"))


@app.route("/api/secrets")
def api_secrets():
    """Proxy to /introspect/secrets."""
    return jsonify(api_get("/introspect/secrets"))


@app.route("/api/docker-build")
def api_docker_build():
    """Proxy to /introspect/docker-build."""
    return jsonify(api_get("/introspect/docker-build"))


@app.route("/api/external-image")
def api_external_image():
    """Proxy to /introspect/external-image."""
    return jsonify(api_get("/introspect/external-image"))


# =============================================================================
# Health checks
# =============================================================================

@app.route("/healthz")
def healthz():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
