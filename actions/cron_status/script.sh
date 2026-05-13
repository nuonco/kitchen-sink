#!/usr/bin/env sh
set -euo pipefail
echo "=== Nodes ===" >> $NUON_ACTIONS_OUTPUT_FILEPATH
kubectl get nodes -o wide >> $NUON_ACTIONS_OUTPUT_FILEPATH
echo "=== Pods ===" >> $NUON_ACTIONS_OUTPUT_FILEPATH
kubectl get pods -n kitchen-sink -o wide >> $NUON_ACTIONS_OUTPUT_FILEPATH
echo "=== Services ===" >> $NUON_ACTIONS_OUTPUT_FILEPATH
kubectl get svc -n kitchen-sink -o wide >> $NUON_ACTIONS_OUTPUT_FILEPATH
echo "=== Ingresses ===" >> $NUON_ACTIONS_OUTPUT_FILEPATH
kubectl get ingress -n kitchen-sink -o wide >> $NUON_ACTIONS_OUTPUT_FILEPATH
