#!/usr/bin/env sh
set -euo pipefail
echo "lifecycle hook fired: trigger=${NUON_TRIGGER_TYPE:-unknown}" >> $NUON_ACTIONS_OUTPUT_FILEPATH
echo "install_id=${NUON_INSTALL_ID:-unknown}" >> $NUON_ACTIONS_OUTPUT_FILEPATH
echo "timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> $NUON_ACTIONS_OUTPUT_FILEPATH
