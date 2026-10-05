#!/usr/bin/env bash
set -euo pipefail

: "${DNS_ZONE:?}" "${PROJECT_ID:?}"

gcloud config set project "${PROJECT_ID}" >/dev/null
gcloud dns managed-zones describe "${DNS_ZONE}"
gcloud dns record-sets list --zone="${DNS_ZONE}"
