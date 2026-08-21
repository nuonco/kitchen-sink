#!/usr/bin/env sh
# Emergency-pause drill: pause every pipeline, prove the engine starts nothing
# new, then resume. Every step is real — the UPDATE hits the live pipelines
# table and the engine's scheduler skips paused pipelines on its next tick. In
# a real emergency, stop at the pause: comment out or skip the resume block.
#
# Diagnostics go to STDOUT (captured as the action's logs). Do NOT write
# free-form text to $NUON_ACTIONS_OUTPUT_FILEPATH — Nuon parses that file as
# structured outputs (a JSON object or k=v lines), so a raw dump fails with
# "unsupported outputs format".
#
# This action runs under the break-glass role from break_glass.toml. The
# caller-identity dump below is the proof: it prints the assumed role ARN,
# which should be <install-id>-app-break-glass.
set -uo pipefail

psql_cmd() {
  kubectl exec deploy/conduit-postgres -n conduit -- \
    psql -U conduit -d conduit -c "$1" 2>&1
}
psql_val() {
  kubectl exec deploy/conduit-postgres -n conduit -- \
    psql -U conduit -d conduit -tAc "$1" 2>/dev/null | tr -d '[:space:]'
}

echo "=== Caller identity (should be the break-glass role) ==="
if command -v aws >/dev/null 2>&1; then
  aws sts get-caller-identity 2>&1 || true
else
  echo "aws CLI not on PATH; skipping identity check"
fi

echo "=== Secrets Manager is denied by the role's boundary (expected failure) ==="
if command -v aws >/dev/null 2>&1; then
  aws secretsmanager list-secrets --max-results 1 2>&1 | head -5 || true
fi

echo "=== Pods before the pause ==="
kubectl get pods -n conduit -o wide 2>&1 || true

echo "=== Pausing every pipeline ==="
psql_cmd "UPDATE pipelines SET paused = true;" || true
psql_cmd "SELECT name, paused, interval_seconds FROM pipelines ORDER BY name;" || true
paused_count=$(psql_val "SELECT count(*) FROM pipelines WHERE paused;")
paused_count=${paused_count:-0}

echo "=== Waiting 60s, then verifying no new sync runs started ==="
sleep 60
new_runs=$(psql_val "SELECT count(*) FROM sync_runs WHERE started_at > now() - interval '60 seconds';")
new_runs=${new_runs:-0}
echo "sync runs started during the pause window: $new_runs (expected 0)"

echo "=== Resuming (a real emergency stops before this) ==="
psql_cmd "UPDATE pipelines SET paused = false;" || true
psql_cmd "SELECT name, paused FROM pipelines ORDER BY name;" || true

# Structured outputs for Nuon (valid k=v).
{
  printf 'pipelines_paused=%s\n' "$paused_count"
  printf 'runs_started_during_pause=%s\n' "$new_runs"
  printf 'drilled_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [ "$paused_count" -gt 0 ] && [ "$new_runs" -eq 0 ]; then
    printf 'status=ok\n'
  else
    printf 'status=degraded\n'
  fi
} >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
