#!/usr/bin/env sh
set -euo pipefail
result=$(curl -sf http://kitchen-sink-api.kitchen-sink.svc.cluster.local:8080/readyz | jq -c)
echo $result >> $NUON_ACTIONS_OUTPUT_FILEPATH
