#!/usr/bin/env bash
# Recreates the access entry for each role in ROLES with AmazonEKSClusterAdminPolicy at cluster scope.
# Idempotent.
set -euo pipefail

POLICY_ARN="arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

if [[ "${TRIGGER_TYPE:-}" == "role-enabled" && "${ROLE_NAME:-}" != *-access-entries-break-glass ]]; then
  echo "role-enabled for '${ROLE_NAME:-}', not the access-entries break-glass role; skipping."
  echo '{"skipped": true}' > "$NUON_ACTIONS_OUTPUT_FILEPATH"
  exit 0
fi

AWS_PAGER="" aws sts get-caller-identity | jq -c

output='{}'
failures=0

create_access_entry() {
  local role="$1"
  local principal_arn="arn:aws:iam::${ACCOUNT_ID}:role/${role}"
  local state="created"
  local metadata='{}'
  local create_out

  # recreate any existing entry
  if aws eks describe-access-entry --cluster-name "$CLUSTER_NAME" --principal-arn "$principal_arn" > /dev/null 2>&1; then
    aws eks delete-access-entry --cluster-name "$CLUSTER_NAME" --principal-arn "$principal_arn"
    echo "Deleted existing access entry for ${role}."
    state="recreated"
  fi

  if create_out=$(aws eks create-access-entry \
    --cluster-name "$CLUSTER_NAME" \
    --principal-arn "$principal_arn" \
    --type STANDARD 2>&1); then
    echo "Created access entry for ${role}."
  else
    echo "Error: failed to create access entry for ${role}: ${create_out}" >&2
    output=$(jq \
      --arg key "$role" \
      --arg principal_arn "$principal_arn" \
      --arg error "$create_out" \
      '.[$key] = {principal_arn: $principal_arn, state: "create_failed", error: $error}' <<< "$output")
    failures=$((failures + 1))
    return 0
  fi

  aws eks associate-access-policy \
    --cluster-name "$CLUSTER_NAME" \
    --principal-arn "$principal_arn" \
    --policy-arn "$POLICY_ARN" \
    --access-scope type=cluster > /dev/null
  echo "Associated ${POLICY_ARN} with ${role}."

  if entry=$(aws eks describe-access-entry \
    --cluster-name "$CLUSTER_NAME" \
    --principal-arn "$principal_arn" 2>/dev/null); then
    metadata=$(jq '.accessEntry' <<< "$entry")
  fi

  output=$(jq \
    --arg key "$role" \
    --arg principal_arn "$principal_arn" \
    --arg state "$state" \
    --arg policy_arn "$POLICY_ARN" \
    --argjson metadata "$metadata" \
    '.[$key] = {principal_arn: $principal_arn, state: $state, policy_arn: $policy_arn, access_scope: "cluster", metadata: $metadata}' <<< "$output")
}

IFS=',' read -ra roles <<< "$ROLES"
for role in "${roles[@]}"; do
  role="$(xargs <<< "$role")"
  [[ -z "$role" ]] && continue
  create_access_entry "$role"
done

jq -c . <<< "$output" > "$NUON_ACTIONS_OUTPUT_FILEPATH"

if (( failures > 0 )); then
  echo "Error: ${failures} role(s) failed." >&2
  exit 1
fi
