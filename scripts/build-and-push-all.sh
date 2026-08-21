#!/usr/bin/env bash
#
# Build and push every image in this repo:
#   - api  (components/api  -> kitchen-sink-app; also backs img_premium_connector + worker)
#   - ui   (components/ui   -> kitchen-sink-ui)
#
# Common flags (--region, --profile, --tag) are forwarded to every image.
#
# Usage: scripts/build-and-push-all.sh [--region R] [--profile P] [--tag TAG]
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  grep '^#' "$0" | grep -v '^#!' | sed 's/^# \{0,1\}//'
  exit 0
fi

# One immutable tag for the whole run (unless the caller passed --tag) so both
# images share a build id and each component toml is stamped to match ECR.
if [[ " $* " != *" --tag "* ]]; then
  set -- "$@" --tag "$(default_image_tag)"
fi

echo "==> api image"
"${SCRIPT_DIR}/build-image.sh" "$@"
"${SCRIPT_DIR}/push-image.sh" "$@" --stamp-config "${REPO_ROOT}/components/images/api.toml"

echo "==> ui image"
"${SCRIPT_DIR}/build-ui-image.sh" "$@"
"${SCRIPT_DIR}/push-ui-image.sh" "$@" --stamp-config "${REPO_ROOT}/components/images/ui.toml"

echo "All images built and pushed."
