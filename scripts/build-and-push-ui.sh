#!/usr/bin/env bash
#
# Build and push the kitchen-sink UI image to ECR Public in one step. Use
# this only to see UI changes on an install before the branch merges — the
# repo's CI does this automatically on merge to main (see
# .github/workflows/build-images.yaml) and stamps components/images/ui.toml +
# components/chart/nuon.toml to match.
#
# Unlike build-and-push.sh / build-and-push-all.sh, this can't delegate the
# push to push-image.sh: that pushes to *private* ECR (`aws ecr`), one
# registry per AWS account. This image is pulled anonymously by a runner in
# someone else's account, so it has to go to ECR Public instead (`aws
# ecr-public`, always served from us-east-1, registry public.ecr.aws/<alias>).
# It also doesn't stamp the config the way push-image.sh --stamp-config would
# — this pushes to a sandbox account, and auto-stamping would put a sandbox
# pointer back into the tracked config. It prints the edits instead of
# making them.
#
# Needs docker, and AWS credentials for an account you can create an ECR
# Public repository in.
#
# Usage: scripts/build-and-push-ui.sh [--region R] [--profile P] [--tag TAG]
#
#   aws sso login --profile sandbox-ms.NuonPowerUser
#   scripts/build-and-push-ui.sh
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ECR Public is always served from us-east-1, this targets the sandbox
# account rather than lib.sh's shared-prod defaults, and kitchen-sink-ui is
# this script's repo/context, not lib.sh's kitchen-sink-app/components/api
# defaults. All four are ${VAR:-...} reads that lib.sh applies at SOURCE
# time, so they must be set before sourcing it — setting them after is a
# silent no-op, since lib.sh's own default has already landed by then.
# --region / --profile / --repo-name still override via flags.
REGION="${REGION:-us-east-1}"
PROFILE="${PROFILE:-sandbox-ms.NuonPowerUser}"
REPO_NAME="${REPO_NAME:-kitchen-sink-ui}"
BUILD_CONTEXT="${BUILD_CONTEXT:-${REPO_ROOT}/components/ui}"
source "${SCRIPT_DIR}/lib.sh"
parse_common_flags "$@"

if [[ "${COMMON_HELP:-0}" == "1" ]]; then
  grep '^#' "$0" | grep -v '^#!' | sed 's/^# \{0,1\}//'
  exit 0
fi

# Pick one immutable tag for the whole run, unless the caller overrode it.
finalize_defaults

"${SCRIPT_DIR}/build-ui-image.sh" \
  --region "${REGION}" --profile "${PROFILE}" --tag "${TAG}" --repo-name "${REPO_NAME}"

AWS_OPTS=(--region "$REGION")
if [[ -n "$PROFILE" ]]; then
  AWS_OPTS+=(--profile "$PROFILE")
fi

ALIAS="$(aws "${AWS_OPTS[@]}" ecr-public describe-registries \
  --query 'registries[0].aliases[0].name' --output text)"
REPO="public.ecr.aws/${ALIAS}/${REPO_NAME}"

echo "Registry: public.ecr.aws/${ALIAS}"
echo "Target:   ${REPO}:${TAG}"

if aws "${AWS_OPTS[@]}" ecr-public describe-repositories --repository-names "${REPO_NAME}" >/dev/null 2>&1; then
  echo "Repository '${REPO_NAME}' exists."
else
  echo "Repository '${REPO_NAME}' not found; creating..."
  aws "${AWS_OPTS[@]}" ecr-public create-repository --repository-name "${REPO_NAME}" >/dev/null
  echo "Created repository '${REPO_NAME}'."
fi

echo "Authenticating to ECR Public..."
aws "${AWS_OPTS[@]}" ecr-public get-login-password \
  | docker login --username AWS --password-stdin public.ecr.aws

echo "Tagging and pushing..."
docker tag "${LOCAL_IMAGE}:${TAG}" "${REPO}:${TAG}"
docker push "${REPO}:${TAG}"

echo "Pushed ${REPO}:${TAG}"
echo
echo "To deploy it, set in components/images/ui.toml:"
echo "    image_url = \"${REPO}\""
echo "    tag       = \"${TAG}\""
echo "and image_stamp = \"${TAG}\" in components/chart/nuon.toml, then sync."
