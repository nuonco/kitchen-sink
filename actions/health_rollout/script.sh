#!/usr/bin/env sh
# Diagnostics to STDOUT; only k=v to the outputs file.
set -uo pipefail

for deploy in api ui worker; do
  echo "=== rollout status: kitchen-sink-$deploy ==="
  if kubectl rollout status "deploy/kitchen-sink-$deploy" -n kitchen-sink --timeout=60s 2>&1; then
    state=complete
  else
    state=progressing
  fi
  printf '%s_rollout=%s\n' "$deploy" "$state" >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
done
printf 'checked_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
