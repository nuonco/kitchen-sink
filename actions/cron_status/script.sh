#!/usr/bin/env sh
# Diagnostics go to STDOUT (captured as the action's logs). Do NOT write
# free-form text to $NUON_ACTIONS_OUTPUT_FILEPATH — Nuon parses that file as
# structured outputs (a JSON object or k=v lines), so a raw dump fails with
# "unsupported outputs format". The install README's "Health pulse" tile reads
# pods_ready / pods_total / checked_at from these outputs.
set -uo pipefail

echo "=== Nodes ==="
kubectl get nodes -o wide 2>&1 || true
echo "=== Pods ==="
kubectl get pods -n relay -o wide 2>&1 || true
echo "=== Services ==="
kubectl get svc -n relay -o wide 2>&1 || true
echo "=== Ingresses ==="
kubectl get ingress -n relay -o wide 2>&1 || true

pods=$(kubectl get pods -n relay --no-headers 2>/dev/null || true)
total=0
ready=0
if [ -n "$pods" ]; then
  total=$(printf '%s\n' "$pods" | wc -l | tr -d ' ')
  ready=$(printf '%s\n' "$pods" | awk '{split($2, a, "/"); if (a[1] == a[2]) c++} END {print c+0}')
fi

# Structured outputs for Nuon (valid k=v).
{
  printf 'pods_ready=%s\n' "$ready"
  printf 'pods_total=%s\n' "$total"
  printf 'checked_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [ "$total" -gt 0 ] && [ "$ready" -ge "$total" ]; then
    printf 'status=ok\n'
  else
    printf 'status=degraded\n'
  fi
} >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
