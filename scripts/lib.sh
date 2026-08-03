#!/usr/bin/env bash
# Shared config + helpers for the image build/push scripts.
# Source this from the other scripts; not meant to be run directly.
set -euo pipefail

# Defaults (override via flags or env). LOCAL_IMAGE and BUILD_CONTEXT are
# finalized in finalize_defaults() after flags are parsed.
REGION="${REGION:-us-west-2}"
PROFILE="${PROFILE:-infra-shared-prod.NuonAdmin}"
TAG="${TAG:-latest}"
REPO_NAME="${REPO_NAME:-kitchen-sink-app}"
LOCAL_IMAGE="${LOCAL_IMAGE:-}"     # defaults to REPO_NAME
BUILD_CONTEXT="${BUILD_CONTEXT:-}" # defaults to components/api

# Repo layout.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

parse_common_flags() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --region)    REGION="$2"; shift 2 ;;
      --profile)   PROFILE="$2"; shift 2 ;;
      --tag)       TAG="$2"; shift 2 ;;
      --repo-name) REPO_NAME="$2"; shift 2 ;;
      --context)   BUILD_CONTEXT="$2"; shift 2 ;;
      -h|--help)   COMMON_HELP=1; shift ;;
      *)           echo "unknown option: $1" >&2; exit 2 ;;
    esac
  done
}

# Apply defaults that depend on parsed flags. The local docker tag defaults to
# the repo name, and the build context defaults to the api component.
finalize_defaults() {
  LOCAL_IMAGE="${LOCAL_IMAGE:-$REPO_NAME}"
  BUILD_CONTEXT="${BUILD_CONTEXT:-${REPO_ROOT}/components/api}"
}

registry() {
  local account
  account="$(aws "$@" sts get-caller-identity --query Account --output text)"
  printf '%s.dkr.ecr.%s.amazonaws.com' "$account" "$REGION"
}
