#!/usr/bin/env bash
# Deletes the EKS access entry for each role in ROLES. Idempotent.
set -euo pipefail

AWS_PAGER="" aws sts get-caller-identity | jq -c

output='{}'

remove_access_entry() {
  local role="$1"
  local principal_arn="arn:aws:iam::${ACCOUNT_ID}:role/${role}"
  local existed=false
  local metadata='{}'
  local state="not_found"

  if entry=$(aws eks describe-access-entry \
    --cluster-name "$CLUSTER_NAME" \
    --principal-arn "$principal_arn" 2>/dev/null); then
    existed=true
    metadata=$(jq '.accessEntry' <<< "$entry")
    aws eks delete-access-entry \
      --cluster-name "$CLUSTER_NAME" \
      --principal-arn "$principal_arn"
    state="deleted"
    echo "Deleted access entry for ${role}."
  else
    echo "No access entry for ${role}."
  fi

  output=$(jq \
    --arg key "$role" \
    --arg principal_arn "$principal_arn" \
    --argjson existed "$existed" \
    --argjson metadata "$metadata" \
    --arg state "$state" \
    '.[$key] = {principal_arn: $principal_arn, existed: $existed, state: $state, metadata: $metadata}' <<< "$output")
}

IFS=',' read -ra roles <<< "$ROLES"
for role in "${roles[@]}"; do
  role="$(xargs <<< "$role")"
  [[ -z "$role" ]] && continue
  remove_access_entry "$role"
done

jq -c . <<< "$output" > "$NUON_ACTIONS_OUTPUT_FILEPATH"
