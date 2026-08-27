#!/usr/bin/env sh
set -e

status=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "${ENDPOINT}/livez")
nuon_output status "$status"
nuon_output endpoint "$ENDPOINT"
nuon_output image "$IMAGE"

if [ "$status" != "200" ]; then
  echo "health check failed: expected 200, got ${status}" >&2
  exit 1
fi

echo "health check passed"
