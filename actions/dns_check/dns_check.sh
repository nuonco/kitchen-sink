#!/usr/bin/env sh
# Gates the certificate component on the install's public zone resolving from
# off-network. See ./nuon.toml for the image choice.
set -eu

RESOLVER="${RESOLVER:-1.1.1.1}"
ATTEMPTS="${ATTEMPTS:-10}"
SLEEP_SECONDS="${SLEEP_SECONDS:-15}"

emit() {
  if [ -n "${NUON_ACTIONS_OUTPUT_FILEPATH:-}" ]; then
    printf '%s=%s\n' "$1" "$2" >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
  elif command -v nuon_output > /dev/null 2>&1; then
    nuon_output "$1" "$2"
  fi
  echo "${1} = ${2}"
}

emit dig_version "$(dig -v 2>&1 | head -1 | awk '{print $2}')"

attempt=0
nameservers=""
while [ "$attempt" -lt "$ATTEMPTS" ]; do
  attempt=$((attempt + 1))
  nameservers=$(dig +short "@${RESOLVER}" NS "${DOMAIN}" | sort | tr '\n' ',' | sed 's/,*$//')
  if [ -n "$nameservers" ]; then
    break
  fi
  echo "attempt ${attempt}/${ATTEMPTS}: no NS records for ${DOMAIN} at ${RESOLVER} yet"
  sleep "$SLEEP_SECONDS"
done

emit domain "$DOMAIN"
emit resolver "$RESOLVER"
emit attempts "$attempt"
emit nameservers "${nameservers:-none}"

if [ -z "$nameservers" ]; then
  echo "dns gate failed: ${DOMAIN} returned no NS records from ${RESOLVER} after ${ATTEMPTS} attempts." >&2
  echo "the public zone is not delegated, so validation for *.${DOMAIN} would sit in PENDING_VALIDATION." >&2
  exit 1
fi

echo "--- dig @${RESOLVER} NS ${DOMAIN} ---"
dig "@${RESOLVER}" NS "${DOMAIN}" +noall +answer

# A delegation record can exist before the zone answers, so ask the zone's own
# nameserver for its SOA to prove it is serving.
authoritative=$(printf '%s\n' "$nameservers" | cut -d, -f1)
emit authoritative_ns "$authoritative"

echo "--- nslookup -type=SOA ${DOMAIN} ${authoritative} ---"
nslookup -type=SOA "$DOMAIN" "$authoritative"

# Informational: the app record is an alias to the load balancer, which deploys
# after the certificate, so an empty answer here must not fail the gate.
app_addresses=$(dig +short "@${RESOLVER}" A "${APP_HOST}" | tr '\n' ',' | sed 's/,*$//')
emit app_host "$APP_HOST"
emit app_host_addresses "${app_addresses:-unresolved}"
