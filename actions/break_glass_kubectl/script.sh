#!/usr/bin/env sh
# Diagnostics go to STDOUT (captured as the action's logs). Do NOT write
# free-form text to $NUON_ACTIONS_OUTPUT_FILEPATH — Nuon parses that file as
# structured outputs (a JSON object or k=v lines), so a raw dump fails with
# "unsupported outputs format".
#
# On role-enabled/role-disabled hooks Nuon sets ROLE_NAME and CHANGE_TYPE.
# enabled  -> create an EKS access entry for $PRINCIPAL_ARN + cluster-admin policy
# disabled -> delete that access entry
# manual   -> report whether the entry currently exists
set -uo pipefail

finish() {
  {
    printf 'status=%s\n' "$1"
    printf 'principal=%s\n' "${PRINCIPAL_ARN:-}"
    printf 'synced_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
  exit "${2:-0}"
}

# Only the break-glass role gates kubectl access; ignore other role changes.
if [ -n "${ROLE_NAME:-}" ] && [ "$ROLE_NAME" != "$BREAK_GLASS_ROLE_NAME" ]; then
  echo "role $ROLE_NAME is not $BREAK_GLASS_ROLE_NAME; nothing to do"
  finish skipped
fi

case "${PRINCIPAL_ARN:-}" in "" | "<no value>")
  echo "kubectl_principal input is not set; nothing to grant or revoke"
  finish unconfigured
  ;;
esac

case "${CHANGE_TYPE:-}" in
enabled)
  echo "=== Granting $PRINCIPAL_ARN kubectl access to $CLUSTER_NAME ==="
  # Tolerate an entry left over from a previous enable.
  aws eks create-access-entry --region "$REGION" --cluster-name "$CLUSTER_NAME" \
    --principal-arn "$PRINCIPAL_ARN" 2>&1 || true
  if aws eks associate-access-policy --region "$REGION" --cluster-name "$CLUSTER_NAME" \
    --principal-arn "$PRINCIPAL_ARN" \
    --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy \
    --access-scope type=cluster 2>&1; then
    finish granted
  fi
  finish error 1
  ;;
disabled)
  echo "=== Revoking kubectl access for $PRINCIPAL_ARN ==="
  if aws eks delete-access-entry --region "$REGION" --cluster-name "$CLUSTER_NAME" \
    --principal-arn "$PRINCIPAL_ARN" 2>&1; then
    finish revoked
  fi
  echo "no access entry to delete"
  finish revoked
  ;;
*)
  echo "=== Current access entry (manual runs report state only) ==="
  if aws eks describe-access-entry --region "$REGION" --cluster-name "$CLUSTER_NAME" \
    --principal-arn "$PRINCIPAL_ARN" 2>&1; then
    finish granted
  fi
  finish revoked
  ;;
esac
