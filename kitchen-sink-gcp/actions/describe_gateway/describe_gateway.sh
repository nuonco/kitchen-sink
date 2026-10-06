#!/usr/bin/env bash
set -euo pipefail

: "${INSTALL_ID:?}" "${PROJECT_ID:?}"

gcloud config set project "${PROJECT_ID}" >/dev/null
gcloud compute forwarding-rules list --filter="description~${INSTALL_ID}"
gcloud compute backend-services list --filter="description~${INSTALL_ID}"
gcloud compute url-maps list --filter="description~${INSTALL_ID}"
gcloud compute ssl-certificates list --filter="description~${INSTALL_ID}"
kubectl get gateway,httproute -n kitchen-sink -o wide
