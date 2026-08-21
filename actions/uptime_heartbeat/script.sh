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
kubectl get pods -n periscope -o wide 2>&1 || true
echo "=== Services ==="
kubectl get svc -n periscope -o wide 2>&1 || true
echo "=== Ingresses ==="
kubectl get ingress -n periscope -o wide 2>&1 || true

pods=$(kubectl get pods -n periscope --no-headers 2>/dev/null || true)
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

# Snapshot to the report archive (REPORT_BUCKET is set in nuon.toml; the
# actions role grants s3:PutObject on it). Tolerant on purpose — this action
# feeds the install README's health tile, and archiving must never break the
# heartbeat itself. When the upload succeeds, report_object joins the outputs.
if [ -n "${REPORT_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  snapshot=$(mktemp)
  {
    echo "heartbeat snapshot, generated $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'pods_ready=%s pods_total=%s\n' "$ready" "$total"
    kubectl get pods -n periscope -o wide 2>&1 || true
  } > "$snapshot"
  key="heartbeats/$(date -u +%Y%m%dT%H%M%SZ).txt"
  if aws s3 cp "$snapshot" "s3://${REPORT_BUCKET}/${key}"; then
    printf 'report_object=s3://%s/%s\n' "$REPORT_BUCKET" "$key" >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
  else
    echo "report archive upload failed (bucket ${REPORT_BUCKET}); heartbeat outputs unaffected"
  fi
fi
