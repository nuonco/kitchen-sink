#!/usr/bin/env sh
set -euo pipefail

echo "We're testing this for the github label rollout"
printf 'status=ok\n' >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
