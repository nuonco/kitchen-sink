#!/usr/bin/env sh
# Runner liveness / install context. Logs go to STDOUT; only k=v lines
# go to $NUON_ACTIONS_OUTPUT_FILEPATH (Nuon parses that as structured outputs).
set -euo pipefail

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
install_id="${NUON_INSTALL_ID:-unknown}"
trigger="${NUON_TRIGGER_TYPE:-unknown}"

echo "=== label_ping ==="
echo "timestamp   ${ts}"
echo "install_id  ${install_id}"
echo "trigger     ${trigger}"
echo "uname       $(uname -a)"
echo "done"

{
  printf 'status=ok\n'
  printf 'timestamp=%s\n' "$ts"
  printf 'install_id=%s\n' "$install_id"
} >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
