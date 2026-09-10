#!/usr/bin/env sh
set -uo pipefail

echo "=== ALB ingress ==="
kubectl describe ingress kitchen-sink-alb -n kitchen-sink 2>&1 || true

addr=$(kubectl get ingress kitchen-sink-alb -n kitchen-sink \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true)
[ -z "$addr" ] && addr=pending

healthy=$(kubectl get endpoints -n kitchen-sink --no-headers 2>/dev/null \
  | awk '$2 != "<none>" {c++} END {print c+0}')

{
  printf 'alb_address=%s\n' "$addr"
  printf 'targets_healthy=%s\n' "$healthy"
  printf 'checked_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
