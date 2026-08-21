#!/usr/bin/env bash
#
# Build and push the kitchen-sink api image in one step. This is the common
# loop when iterating on the api/worker code so a new image lands in ECR for
# the img_api / img_collector_premium components to resolve.
#
# Usage: scripts/build-and-push.sh [--region R] [--profile P] [--tag TAG] [--repo-name NAME]
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib.sh"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  grep '^#' "$0" | grep -v '^#!' | sed 's/^# \{0,1\}//'
  exit 0
fi

# Pick one immutable tag for this run (unless the caller passed --tag) so the
# build and push agree and so the stamped component toml matches ECR.
if [[ " $* " != *" --tag "* ]]; then
  set -- "$@" --tag "$(default_image_tag)"
fi

"${SCRIPT_DIR}/build-image.sh" "$@"
"${SCRIPT_DIR}/push-image.sh" "$@" --stamp-config "${REPO_ROOT}/components/images/api.toml"
