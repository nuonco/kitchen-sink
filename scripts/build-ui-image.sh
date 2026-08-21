#!/usr/bin/env bash
#
# Build the Relay console image from components/ui (ECR repo: kitchen-sink-ui).
# Thin wrapper over build-image.sh with the UI context and repo name.
#
# Usage: scripts/build-ui-image.sh [--tag TAG]
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
exec "${SCRIPT_DIR}/build-image.sh" \
  --repo-name kitchen-sink-ui \
  --context "${REPO_ROOT}/components/ui" \
  "$@"
