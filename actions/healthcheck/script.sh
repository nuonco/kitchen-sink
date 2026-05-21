#!/usr/bin/env sh
set -euo pipefail
ENDPOINT="${CHECK_ENDPOINT:-http://kitchen-sink-api.kitchen-sink.svc.cluster.local:8080/readyz}"
result=$(curl -sf "$ENDPOINT" | jq -c)
echo $result >> $NUON_ACTIONS_OUTPUT_FILEPATH
