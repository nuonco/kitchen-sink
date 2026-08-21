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

echo "=== Delivery stats (via the public console API) ==="
# The heartbeat that matters for a delivery platform: is Relay actually
# delivering? Read through the ALB because this script runs on the RUNNER,
# outside the cluster, where relay-api.relay.svc.cluster.local does not
# resolve.
stats=""
if [ -n "${APP_URL:-}" ]; then
  stats=$(curl -fsS --max-time 15 "$APP_URL/api/delivery/stats" 2>&1) \
    && echo "$stats" \
    || { echo "delivery stats unreachable: $stats"; stats=""; }
else
  echo "APP_URL not set; skipping delivery stats"
fi

# Pull single numeric fields out of the one-line stats JSON (no jq on the
# runner image; the shapes are flat integers/floats).
json_num() {
  printf '%s' "$stats" | grep -o "\"$1\":[0-9.]*" | head -1 | cut -d: -f2
}
events_24h=$(json_num events_24h)
delivered_24h=$(json_num delivered_24h)
success_rate=$(json_num success_rate)
dlq_depth=$(json_num dlq_depth)

pods=$(kubectl get pods -n relay --no-headers 2>/dev/null || true)
total=0
ready=0
if [ -n "$pods" ]; then
  total=$(printf '%s\n' "$pods" | wc -l | tr -d ' ')
  ready=$(printf '%s\n' "$pods" | awk '{split($2, a, "/"); if (a[1] == a[2]) c++} END {print c+0}')
fi

# Structured outputs for Nuon (valid k=v). pods_ready / pods_total /
# checked_at / status keep their existing semantics (the install README's
# Health pulse tile reads them); the delivery_* keys are additive.
{
  printf 'pods_ready=%s\n' "$ready"
  printf 'pods_total=%s\n' "$total"
  printf 'checked_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  if [ "$total" -gt 0 ] && [ "$ready" -ge "$total" ]; then
    printf 'status=ok\n'
  else
    printf 'status=degraded\n'
  fi
  if [ -n "$stats" ]; then
    printf 'delivery_events_24h=%s\n' "${events_24h:-0}"
    printf 'delivery_delivered_24h=%s\n' "${delivered_24h:-0}"
    printf 'delivery_success_rate=%s\n' "${success_rate:-0}"
    printf 'delivery_dlq_depth=%s\n' "${dlq_depth:-0}"
    printf 'delivery_status=ok\n'
  else
    printf 'delivery_status=unreachable\n'
  fi
} >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
