#!/usr/bin/env sh
# Diagnostics go to STDOUT (captured as the action's logs). Do NOT write
# free-form text to $NUON_ACTIONS_OUTPUT_FILEPATH — Nuon parses that file as
# structured outputs (a JSON object or k=v lines), so a raw dump fails with
# "unsupported outputs format". Only the final k=v below goes to that file.
set -uo pipefail

echo "=== Pods ==="
kubectl get pods -n conduit -o wide 2>&1 || true
echo "=== Events ==="
kubectl get events -n conduit --sort-by='.lastTimestamp' 2>&1 | tail -50 || true
echo "=== Helm ==="
helm list -n conduit 2>&1 || true
echo "=== Logs (API) ==="
kubectl logs -n conduit -l app.kubernetes.io/component=api --tail=100 2>&1 || true
echo "=== Logs (UI) ==="
kubectl logs -n conduit -l app.kubernetes.io/component=ui --tail=100 2>&1 || true

# Structured outputs for Nuon (valid k=v).
printf 'status=collected\n' >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
