#!/usr/bin/env sh
set -uo pipefail

echo "=== GET $ENDPOINT ==="
result=$(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time 10 "$ENDPOINT" || echo "000 0")
code=$(echo "$result" | awk '{print $1}')
ms=$(echo "$result" | awk '{printf "%.0f", $2 * 1000}')

echo "http_status=$code in ${ms}ms"

{
  printf 'http_status=%s\n' "$code"
  printf 'latency_ms=%s\n' "$ms"
  printf 'checked_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
