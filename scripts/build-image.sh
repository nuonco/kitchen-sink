#!/usr/bin/env bash
#
# Build the Relay api image (which also runs the delivery worker) as a single-
# platform image so the pushed manifest stays simple for the Nuon builder.
#
# Usage: scripts/build-image.sh [--tag TAG] [--repo-name NAME] [--context DIR]
#
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
parse_common_flags "$@"

if [[ "${COMMON_HELP:-0}" == "1" ]]; then
  grep '^#' "$0" | grep -v '^#!' | sed 's/^# \{0,1\}//'
  exit 0
fi

finalize_defaults

echo "Building ${LOCAL_IMAGE}:${TAG} from ${BUILD_CONTEXT}"
docker build \
  --platform linux/amd64 \
  --provenance=false \
  -t "${LOCAL_IMAGE}:${TAG}" \
  "${BUILD_CONTEXT}"

echo "Built ${LOCAL_IMAGE}:${TAG}"
