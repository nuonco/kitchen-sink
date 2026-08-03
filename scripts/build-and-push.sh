#!/usr/bin/env bash
#
# Build and push the kitchen-sink api image in one step. This is the common
# loop when iterating on the api/worker code so a new image lands in ECR for
# the img_api / img_api_two components to resolve.
#
# Usage: scripts/build-and-push.sh [--region R] [--profile P] [--tag TAG] [--repo-name NAME]
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  grep '^#' "$0" | grep -v '^#!' | sed 's/^# \{0,1\}//'
  exit 0
fi

"${SCRIPT_DIR}/build-image.sh" "$@"
"${SCRIPT_DIR}/push-image.sh" "$@"
