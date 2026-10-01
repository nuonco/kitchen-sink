#!/usr/bin/env sh
# Compare the nameservers Nuon provisioned (sandbox outputs) to what a public
# resolver returns for the install domain. See ./nuon.toml for the image.
set -eu

RESOLVER="${RESOLVER:-1.1.1.1}"
ATTEMPTS="${ATTEMPTS:-10}"
SLEEP_SECONDS="${SLEEP_SECONDS:-15}"
EXPECTED_NS="${EXPECTED_NS:-}"

emit() {
  if [ -n "${NUON_ACTIONS_OUTPUT_FILEPATH:-}" ]; then
    printf '%s=%s\n' "$1" "$2" >> "$NUON_ACTIONS_OUTPUT_FILEPATH"
  elif command -v nuon_output > /dev/null 2>&1; then
    nuon_output "$1" "$2"
  fi
  echo "${1} = ${2}"
}

norm() {
  tr 'A-Z' 'a-z' | sed 's/\.$//' | sed '/^$/d' | sort -u
}

join_lines() {
  tr '\n' ',' | sed 's/,$//'
}

emit dig_version "$(dig -v 2>&1 | head -1 | awk '{print $2}')"
emit domain "$DOMAIN"
emit resolver "$RESOLVER"

expected=$(printf '%s\n' ${EXPECTED_NS} | norm)
emit expected_nameservers "$(printf '%s\n' "$expected" | join_lines)"

attempt=0
observed=""
while [ "$attempt" -lt "$ATTEMPTS" ]; do
  attempt=$((attempt + 1))
  observed=$(dig +short "@${RESOLVER}" NS "${DOMAIN}" 2>/dev/null | norm)
  if [ -n "$observed" ]; then
    break
  fi
  echo "attempt ${attempt}/${ATTEMPTS}: no NS records for ${DOMAIN} at ${RESOLVER} yet"
  sleep "$SLEEP_SECONDS"
done

emit attempts "$attempt"
emit observed_nameservers "$(printf '%s\n' "${observed:-}" | join_lines)"

if [ -z "$observed" ]; then
  emit match "false"
  echo "dns check failed: ${DOMAIN} returned no NS records from ${RESOLVER} after ${ATTEMPTS} attempts." >&2
  echo "the public zone is not delegated, so validation for *.${DOMAIN} would sit in PENDING_VALIDATION." >&2
  exit 1
fi

echo "--- expected nameservers (sandbox) ---"
echo "$expected" | sed 's/^/  /'

echo "--- dig @${RESOLVER} NS ${DOMAIN} ---"
dig "@${RESOLVER}" NS "${DOMAIN}" +noall +answer

missing=""
for ns in $expected; do
  if ! printf '%s\n' $observed | grep -qxF "$ns"; then
    missing="${missing}${missing:+,}${ns}"
  fi
done

extra=""
for ns in $observed; do
  if ! printf '%s\n' $expected | grep -qxF "$ns"; then
    extra="${extra}${extra:+,}${ns}"
  fi
done

emit missing_nameservers "${missing:-}"
emit extra_nameservers "${extra:-}"

if [ -z "$expected" ]; then
  emit match "unknown"
  echo "sandbox nameservers were empty; observed NS records but could not compare."
  exit 0
fi

if [ -n "$missing" ] || [ -n "$extra" ]; then
  emit match "false"
  echo "dns check failed: public NS records do not match the sandbox zone." >&2
  [ -n "$missing" ] && echo "missing: ${missing}" >&2
  [ -n "$extra" ] && echo "extra: ${extra}" >&2
  exit 1
fi

emit match "true"

authoritative=$(printf '%s\n' $observed | head -1)
emit authoritative_ns "$authoritative"

echo "--- nslookup -type=SOA ${DOMAIN} ${authoritative} ---"
nslookup -type=SOA "$DOMAIN" "$authoritative"

# Informational: the app record is an alias to the load balancer, which deploys
# after the certificate, so an empty answer here must not fail the check.
app_addresses=$(dig +short "@${RESOLVER}" A "${APP_HOST}" | tr '\n' ',' | sed 's/,*$//')
emit app_host "$APP_HOST"
emit app_host_addresses "${app_addresses:-unresolved}"
