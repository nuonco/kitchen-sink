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
kubectl get pods -n relay -o wide 2>&1 || true

echo "=== Restarting the Relay workloads ==="
restarted=0
for deploy in relay-api relay-ui relay-worker; do
  if kubectl rollout restart "deploy/$deploy" -n relay 2>&1; then
    restarted=$((restarted + 1))
  fi
done

echo "=== Waiting for rollouts ==="
rollouts_ok=0
for deploy in relay-api relay-ui relay-worker; do
  if kubectl rollout status "deploy/$deploy" -n relay --timeout=4m 2>&1; then
    rollouts_ok=$((rollouts_ok + 1))
  fi
done

echo "=== Pods after remediation ==="
kubectl get pods -n relay -o wide 2>&1 || true

echo "=== Draining the dead-letter queue ==="
# A restart un-sticks the pipeline but does not touch the deliveries that
# already exhausted their retries. Replaying them is the other half of the
# remediation: each replay re-queues one real delivery attempt. Primary path
# is the public ALB (the runner is outside the cluster); if the console proxy
# refuses, fall back to the api pod itself via kubectl exec.
max_replays="${MAX_DLQ_REPLAYS:-25}"
via=""
dlq_json=""
if [ -n "${APP_URL:-}" ]; then
  dlq_json=$(curl -fsS --max-time 15 "$APP_URL/api/delivery/dlq" 2>/dev/null) && via="alb" || dlq_json=""
fi
if [ -z "$dlq_json" ]; then
  echo "console proxy unreachable; reading the DLQ in-cluster via the api pod"
  dlq_json=$(kubectl exec -n relay deploy/relay-api -- wget -qO- http://localhost:8080/delivery/dlq 2>/dev/null) && via="exec" || dlq_json=""
fi

dlq_replayed=0
dlq_found=0
if [ -n "$dlq_json" ]; then
  ids=$(printf '%s' "$dlq_json" | grep -o '"id":"att_[^"]*"' | cut -d'"' -f4 | head -n "$max_replays")
  dlq_found=$(printf '%s' "$dlq_json" | grep -o '"id":"att_[^"]*"' | wc -l | tr -d ' ')
  echo "$dlq_found dead attempt(s); replaying up to $max_replays"
  for id in $ids; do
    replayed_one=0
    if [ "$via" = "alb" ]; then
      if curl -fsS --max-time 15 -X POST "$APP_URL/api/delivery/dlq/$id/replay" 2>&1; then
        echo ""
        replayed_one=1
      else
        echo "replay via the console proxy refused; switching to the in-cluster path"
        via="exec"
      fi
    fi
    if [ "$via" = "exec" ] && [ "$replayed_one" -eq 0 ]; then
      if kubectl exec -n relay deploy/relay-api -- wget -qO- --post-data='' "http://localhost:8080/delivery/dlq/$id/replay" 2>&1; then
        echo ""
        replayed_one=1
      fi
    fi
    dlq_replayed=$((dlq_replayed + replayed_one))
  done
  echo "replayed $dlq_replayed of $dlq_found dead attempt(s); the worker delivers them within seconds"
else
  echo "could not read the DLQ (api unreachable) — skipping the drain"
fi

# Structured outputs for Nuon (valid k=v).
{
  printf 'deployments_restarted=%s\n' "$restarted"
  printf 'rollouts_complete=%s\n' "$rollouts_ok"
  printf 'dlq_found=%s\n' "$dlq_found"
  printf 'dlq_replayed=%s\n' "$dlq_replayed"
  printf 'remediated_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [ "$rollouts_ok" -eq 3 ]; then
    printf 'status=ok\n'
  else
    printf 'status=degraded\n'
  fi
} >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
