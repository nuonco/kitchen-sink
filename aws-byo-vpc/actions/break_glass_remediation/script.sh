#!/usr/bin/env sh
# Diagnostics go to STDOUT (captured as the action's logs). Do NOT write
# free-form text to $NUON_ACTIONS_OUTPUT_FILEPATH — Nuon parses that file as
# structured outputs (a JSON object or k=v lines), so a raw dump fails with
# "unsupported outputs format".
#
# This action runs under the break-glass role from break_glass.toml. The
# caller-identity dump below is the demo's proof of that: it prints the assumed
# role ARN, which should be <install-id>-app-break-glass.
set -uo pipefail

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

echo "=== Pods before remediation ==="
kubectl get pods -n kitchen-sink -o wide 2>&1 || true

echo "=== Restarting the kitchen-sink workloads ==="
restarted=0
for deploy in kitchen-sink-api kitchen-sink-ui kitchen-sink-worker; do
  if kubectl rollout restart "deploy/$deploy" -n kitchen-sink 2>&1; then
    restarted=$((restarted + 1))
  fi
done

echo "=== Waiting for rollouts ==="
rollouts_ok=0
for deploy in kitchen-sink-api kitchen-sink-ui kitchen-sink-worker; do
  if kubectl rollout status "deploy/$deploy" -n kitchen-sink --timeout=4m 2>&1; then
    rollouts_ok=$((rollouts_ok + 1))
  fi
done

echo "=== Pods after remediation ==="
kubectl get pods -n kitchen-sink -o wide 2>&1 || true

# Structured outputs for Nuon (valid k=v).
{
  printf 'deployments_restarted=%s\n' "$restarted"
  printf 'rollouts_complete=%s\n' "$rollouts_ok"
  printf 'remediated_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [ "$rollouts_ok" -eq 3 ]; then
    printf 'status=ok\n'
  else
    printf 'status=degraded\n'
  fi
} >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
