#!/usr/bin/env sh
set -euo pipefail
echo "=== Pods ===" >> $NUON_ACTIONS_OUTPUT_FILEPATH
kubectl get pods -n kitchen-sink -o wide >> $NUON_ACTIONS_OUTPUT_FILEPATH
echo "=== Events ===" >> $NUON_ACTIONS_OUTPUT_FILEPATH
kubectl get events -n kitchen-sink --sort-by='.lastTimestamp' | tail -50 >> $NUON_ACTIONS_OUTPUT_FILEPATH
echo "=== Helm ===" >> $NUON_ACTIONS_OUTPUT_FILEPATH
helm list -n kitchen-sink -o json >> $NUON_ACTIONS_OUTPUT_FILEPATH
echo "=== Logs (API) ===" >> $NUON_ACTIONS_OUTPUT_FILEPATH
kubectl logs -n kitchen-sink -l app.kubernetes.io/component=api --tail=100 >> $NUON_ACTIONS_OUTPUT_FILEPATH 2>&1 || true
echo "=== Logs (UI) ===" >> $NUON_ACTIONS_OUTPUT_FILEPATH
kubectl logs -n kitchen-sink -l app.kubernetes.io/component=ui --tail=100 >> $NUON_ACTIONS_OUTPUT_FILEPATH 2>&1 || true
