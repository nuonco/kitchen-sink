#!/usr/bin/env bash
set -euo pipefail

: "${NETWORK:?}" "${PROJECT_ID:?}" "${REGION:?}"

gcloud config set project "${PROJECT_ID}" >/dev/null
routers=$(gcloud compute routers list \
  --filter="network:${NETWORK} AND region:(${REGION})" \
  --format="value(name)")

for router in ${routers}; do
  gcloud compute routers describe "${router}" --region="${REGION}"
  nats=$(gcloud compute routers nats list \
    --router="${router}" \
    --region="${REGION}" \
    --format="value(name)")
  for nat in ${nats}; do
    gcloud compute routers nats describe "${nat}" \
      --router="${router}" \
      --region="${REGION}"
  done
done

gcloud compute addresses list --filter="region:(${REGION})"
