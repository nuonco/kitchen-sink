#!/usr/bin/env sh
# Diagnostics to STDOUT. Only k=v goes to $NUON_ACTIONS_OUTPUT_FILEPATH —
# Nuon parses that file, and free-form text fails with
# "unsupported outputs format".
set -uo pipefail

echo "=== Nodes ==="
kubectl get nodes -o wide 2>&1 || true

nodes=$(kubectl get nodes --no-headers 2>/dev/null || true)
total=0
ready=0
if [ -n "$nodes" ]; then
  total=$(printf '%s\n' "$nodes" | wc -l | tr -d ' ')
  ready=$(printf '%s\n' "$nodes" | awk '$2 == "Ready" {c++} END {print c+0}')
fi

{
  printf 'node_count=%s\n' "$total"
  printf 'nodes_ready=%s\n' "$ready"
  printf 'checked_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
