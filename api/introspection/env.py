"""
Environment introspection handlers.
Ported from mono/services/e2e/api/internal/introspection/env.go and related files.
"""

import os
from typing import Dict


def get_all_env() -> Dict[str, str]:
    """
    Returns all environment variables.
    GET /introspect/env
    """
    return dict(os.environ)


def get_env_by_prefix(prefix: str) -> Dict[str, str]:
    """
    Returns environment variables matching a prefix.
    Strips the prefix and lowercases the key.
    """
    result = {}
    for key, value in os.environ.items():
        if key.startswith(prefix):
            # Strip prefix and leading underscore, lowercase the key
            clean_key = key[len(prefix):]
            if clean_key.startswith("_"):
                clean_key = clean_key[1:]
            clean_key = clean_key.lower()
            result[clean_key] = value
    return result


def get_terraform_env() -> Dict[str, str]:
    """GET /introspect/terraform - Returns TERRAFORM_* env vars."""
    return get_env_by_prefix("TERRAFORM_")


def get_secrets_env() -> Dict[str, str]:
    """GET /introspect/secrets - Returns SECRET* env vars."""
    return get_env_by_prefix("SECRET")


def get_defaults_env() -> Dict[str, str]:
    """GET /introspect/defaults - Returns DEFAULT* env vars."""
    return get_env_by_prefix("DEFAULT")


def get_sandbox_env() -> Dict[str, str]:
    """GET /introspect/sandbox - Returns SANDBOX* env vars."""
    return get_env_by_prefix("SANDBOX")


def get_nuon_env() -> Dict[str, str]:
    """GET /introspect/nuon - Returns NUON* env vars."""
    return get_env_by_prefix("NUON")


def get_docker_build_env() -> Dict[str, str]:
    """GET /introspect/docker-build - Returns DOCKER_BUILD* env vars."""
    return get_env_by_prefix("DOCKER_BUILD")


def get_external_image_env() -> Dict[str, str]:
    """GET /introspect/external-image - Returns EXTERNAL_IMAGE* env vars."""
    return get_env_by_prefix("EXTERNAL_IMAGE")
