#!/usr/bin/env bash
# Shared config + helpers for the image build/push scripts.
# Source this from the other scripts; not meant to be run directly.
set -euo pipefail

# Defaults (override via flags or env). LOCAL_IMAGE and BUILD_CONTEXT are
# finalized in finalize_defaults() after flags are parsed.
REGION="${REGION:-us-west-2}"
PROFILE="${PROFILE:-infra-shared-prod.NuonAdmin}"
# Empty by default; finalize_defaults() computes an immutable tag when unset.
# Do NOT default to a mutable tag like "latest": Nuon mirrors the source image
# into each install's ECR as `img-<component>-<tag>`, so a fixed tag means the
# rendered helm image ref never changes -> helm sees "no changes" -> stuck pods
# are never rolled. An immutable per-build tag makes every push a real diff.
TAG="${TAG:-}"
REPO_NAME="${REPO_NAME:-kitchen-sink-app}"
LOCAL_IMAGE="${LOCAL_IMAGE:-}"     # defaults to REPO_NAME
BUILD_CONTEXT="${BUILD_CONTEXT:-}" # defaults to components/api
STAMP_CONFIG="${STAMP_CONFIG:-}"   # optional img component toml to update with TAG

# Repo layout.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

parse_common_flags() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --region)    REGION="$2"; shift 2 ;;
      --profile)   PROFILE="$2"; shift 2 ;;
      --tag)         TAG="$2"; shift 2 ;;
      --repo-name)   REPO_NAME="$2"; shift 2 ;;
      --context)     BUILD_CONTEXT="$2"; shift 2 ;;
      --stamp-config) STAMP_CONFIG="$2"; shift 2 ;;
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
  TAG="${TAG:-$(default_image_tag)}"
}

# Compute an immutable image tag from the current commit. When the working tree
# is dirty (the common case while iterating), append a timestamp so repeated
# builds on the same WIP commit still produce a unique tag — otherwise the
# mirrored image ref wouldn't change and helm would report "no changes".
default_image_tag() {
  local sha
  sha="$(git -C "${REPO_ROOT}" rev-parse --short=12 HEAD 2>/dev/null || echo nogit)"
  if [[ -n "$(git -C "${REPO_ROOT}" status --porcelain 2>/dev/null)" ]]; then
    printf '%s-wip%s' "${sha}" "$(date +%Y%m%d%H%M%S)"
  else
    printf '%s' "${sha}"
  fi
}

# Rewrite the `tag = "..."` line in an image component toml so its source tag
# matches what we just pushed. Keeps components/images/*.toml the source of
# truth and in lockstep with ECR.
stamp_image_tag() {
  local file="$1" tag="$2" tmp
  if [[ ! -f "$file" ]]; then
    echo "stamp: no such file: $file" >&2
    return 1
  fi
  tmp="$(mktemp "${TMPDIR:-/tmp}/stamp.XXXXXX")"
  sed -E "s|^([[:space:]]*tag[[:space:]]*=[[:space:]]*).*|\1\"${tag}\"|" "$file" >"$tmp" \
    && mv "$tmp" "$file"
  echo "Stamped ${file}: tag = \"${tag}\""
}

registry() {
  local account
  account="$(aws "$@" sts get-caller-identity --query Account --output text)"
  printf '%s.dkr.ecr.%s.amazonaws.com' "$account" "$REGION"
}
