#!/usr/bin/env sh
set -euo pipefail

echo "We're running this action to test our deployment plan"
printf 'status=ok\n' >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
