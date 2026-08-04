#!/usr/bin/env bash
#
# Authenticate to ECR, then tag and push the locally-built api image.
# Creates the ECR repository if it does not already exist. IAM pull-role setup
# for Nuon is handled separately (see components/scripts/push-to-ecr.sh).
#
# Usage: scripts/push-image.sh [--region R] [--profile P] [--tag TAG] [--repo-name NAME] [--stamp-config TOML]
#
# --stamp-config: after pushing, rewrite the `tag = "..."` line in the given
#   image component toml (e.g. components/images/api.toml) to the pushed tag.
#
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
parse_common_flags "$@"

if [[ "${COMMON_HELP:-0}" == "1" ]]; then
  grep '^#' "$0" | grep -v '^#!' | sed 's/^# \{0,1\}//'
  exit 0
fi

finalize_defaults

AWS_OPTS=(--region "$REGION")
[[ -n "$PROFILE" ]] && AWS_OPTS+=(--profile "$PROFILE")
REGISTRY="$(registry "${AWS_OPTS[@]}")"
FULL_REPO="${REGISTRY}/${REPO_NAME}"

echo "Registry: ${REGISTRY}"
echo "Target:   ${FULL_REPO}:${TAG}"

if aws "${AWS_OPTS[@]}" ecr describe-repositories --repository-names "${REPO_NAME}" >/dev/null 2>&1; then
  echo "Repository '${REPO_NAME}' exists."
else
  echo "Repository '${REPO_NAME}' not found; creating..."
  aws "${AWS_OPTS[@]}" ecr create-repository \
    --repository-name "${REPO_NAME}" \
    --image-scanning-configuration scanOnPush=true \
    --encryption-configuration encryptionType=AES256 >/dev/null
  echo "Created repository '${REPO_NAME}'."
fi

echo "Authenticating to ECR..."
aws "${AWS_OPTS[@]}" ecr get-login-password \
  | docker login --username AWS --password-stdin "${REGISTRY}"

echo "Tagging and pushing..."
docker tag "${LOCAL_IMAGE}:${TAG}" "${FULL_REPO}:${TAG}"
docker push "${FULL_REPO}:${TAG}"

echo "Pushed ${FULL_REPO}:${TAG}"

# Keep the image component's source tag in lockstep with what we pushed, so the
# mirrored (and therefore deployed) image ref changes on every build.
if [[ -n "${STAMP_CONFIG}" ]]; then
  stamp_image_tag "${STAMP_CONFIG}" "${TAG}"
fi
