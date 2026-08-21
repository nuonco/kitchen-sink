#!/usr/bin/env bash
#
# Push the Relay console image to the kitchen-sink-ui ECR repo.
# Thin wrapper over push-image.sh with the UI repo name.
#
# Usage: scripts/push-ui-image.sh [--region R] [--profile P] [--tag TAG]
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/push-image.sh" \
  --repo-name kitchen-sink-ui \
  "$@"
