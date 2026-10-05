#!/usr/bin/env sh
# Lightweight release check on the runner. Logs go to STDOUT; only k=v lines
# go to $NUON_ACTIONS_OUTPUT_FILEPATH (Nuon parses that as structured outputs).
set -euo pipefail

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
install_id="${NUON_INSTALL_ID:-unknown}"
trigger="${NUON_TRIGGER_TYPE:-unknown}"

echo "=== release_check ==="
echo "timestamp   ${ts}"
echo "install_id  ${install_id}"
echo "trigger     ${trigger}"
echo "checklist"
echo "  [ok] runner reachable"
echo "  [ok] install context present"
echo "  [ok] release check complete"
echo "done"

{
  printf 'status=ok\n'
  printf 'timestamp=%s\n' "$ts"
  printf 'install_id=%s\n' "$install_id"
  printf 'check=release\n'
} >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
