#!/usr/bin/env sh
set -eu

nuon_output kubectl_client "$(kubectl version -o json | jq -r .clientVersion.gitVersion)"
nuon_output kubectl_server "$(kubectl version -o json | jq -r .serverVersion.gitVersion)"

for name in api ui worker; do
  kubectl rollout status "deployment/kitchen-sink-${name}" -n kitchen-sink --timeout=60s
  ready=$(kubectl get "deployment/kitchen-sink-${name}" -n kitchen-sink -o jsonpath='{.status.readyReplicas}')
  nuon_output "${name}_ready_replicas" "${ready:-0}"
done
