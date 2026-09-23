#!/usr/bin/env bash
set -euo pipefail

: "${CERTIFICATE_NAME:?}" "${CERT_MAP_NAME:?}" "${PROJECT_ID:?}"

gcloud config set project "${PROJECT_ID}" >/dev/null
gcloud certificate-manager certificates describe "${CERTIFICATE_NAME}" --location=global
gcloud certificate-manager maps describe "${CERT_MAP_NAME}"
