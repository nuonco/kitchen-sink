#!/usr/bin/env sh
# Diagnostics go to STDOUT (captured as the action's logs). Do NOT write
# free-form text to $NUON_ACTIONS_OUTPUT_FILEPATH — Nuon parses that file as
# structured outputs (a JSON object or k=v lines), so a raw dump fails with
# "unsupported outputs format". The install README's health tile reads
# pods_ready / pods_total / checked_at / syncs_succeeded_last_hour from these
# outputs.
set -uo pipefail

psql_exec() {
  kubectl exec deploy/conduit-postgres -n conduit -- \
    psql -U conduit -d conduit -tAc "$1" 2>/dev/null | tr -d '[:space:]'
}

echo "=== Nodes ==="
kubectl get nodes -o wide 2>&1 || true
echo "=== Pods ==="
kubectl get pods -n conduit -o wide 2>&1 || true
echo "=== Services ==="
kubectl get svc -n conduit -o wide 2>&1 || true
echo "=== Ingresses ==="
kubectl get ingress -n conduit -o wide 2>&1 || true

pods=$(kubectl get pods -n conduit --no-headers 2>/dev/null || true)
total=0
ready=0
if [ -n "$pods" ]; then
  total=$(printf '%s\n' "$pods" | wc -l | tr -d ' ')
  ready=$(printf '%s\n' "$pods" | awk '{split($2, a, "/"); if (a[1] == a[2]) c++} END {print c+0}')
fi

echo "=== Sync engine (last hour, from the pipelines database) ==="
pipelines_total=$(psql_exec "SELECT count(*) FROM pipelines;")
succeeded=$(psql_exec "SELECT count(*) FROM sync_runs WHERE status = 'succeeded' AND started_at > now() - interval '1 hour';")
failed=$(psql_exec "SELECT count(*) FROM sync_runs WHERE status = 'failed' AND started_at > now() - interval '1 hour';")
pipelines_total=${pipelines_total:-0}
succeeded=${succeeded:-0}
failed=${failed:-0}
echo "pipelines: $pipelines_total, syncs succeeded: $succeeded, failed: $failed"
kubectl exec deploy/conduit-postgres -n conduit -- \
  psql -U conduit -d conduit -c "SELECT name, paused, interval_seconds FROM pipelines ORDER BY name;" 2>&1 || true

# Structured outputs for Nuon (valid k=v).
{
  printf 'pods_ready=%s\n' "$ready"
  printf 'pods_total=%s\n' "$total"
  printf 'pipelines_total=%s\n' "$pipelines_total"
  printf 'syncs_succeeded_last_hour=%s\n' "$succeeded"
  printf 'syncs_failed_last_hour=%s\n' "$failed"
  printf 'checked_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [ "$total" -gt 0 ] && [ "$ready" -ge "$total" ]; then
    printf 'status=ok\n'
  else
    printf 'status=degraded\n'
  fi
} >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
