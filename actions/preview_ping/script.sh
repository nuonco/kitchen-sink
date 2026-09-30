#!/usr/bin/env sh
# Preview / continuous-release smoke ping. Logs go to STDOUT; only k=v lines
# go to $NUON_ACTIONS_OUTPUT_FILEPATH (Nuon parses that as structured outputs).
set -euo pipefail

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
install_id="${NUON_INSTALL_ID:-unknown}"
trigger="${NUON_TRIGGER_TYPE:-unknown}"

echo "=== preview_ping ==="
echo "timestamp   ${ts}"
echo "install_id  ${install_id}"
echo "trigger     ${trigger}"
echo "purpose     continuous-release preview smoke"
echo "uname       $(uname -a)"
echo "done"

{
  printf 'status=ok\n'
  printf 'timestamp=%s\n' "$ts"
  printf 'install_id=%s\n' "$install_id"
  printf 'purpose=continuous-release-preview-smoke\n'
} >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
