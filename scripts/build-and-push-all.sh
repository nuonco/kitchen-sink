#!/usr/bin/env bash
#
# Build and push every image in this repo:
#   - api  (components/api  -> kitchen-sink-app; also backs img_api_two + worker)
#   - ui   (components/ui   -> kitchen-sink-ui)
#
# Common flags (--region, --profile, --tag) are forwarded to every image.
#
# Usage: scripts/build-and-push-all.sh [--region R] [--profile P] [--tag TAG]
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  grep '^#' "$0" | grep -v '^#!' | sed 's/^# \{0,1\}//'
  exit 0
fi

echo "==> api image"
"${SCRIPT_DIR}/build-image.sh" "$@"
"${SCRIPT_DIR}/push-image.sh" "$@"

echo "==> ui image"
"${SCRIPT_DIR}/build-ui-image.sh" "$@"
"${SCRIPT_DIR}/push-ui-image.sh" "$@"

echo "All images built and pushed."
