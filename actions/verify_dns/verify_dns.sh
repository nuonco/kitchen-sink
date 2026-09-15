#!/usr/bin/env sh
set -eu

pick_resolver() {
  for r in 1.1.1.1 8.8.8.8; do
    if dig +short NS . "@$r" >/dev/null 2>&1; then
      echo "$r"
      return 0
    fi
  done
  echo ""
}

RESOLVER="$(pick_resolver)"
if [ -z "$RESOLVER" ]; then
  echo "could not reach 1.1.1.1 or 8.8.8.8"
  exit 1
fi
echo "resolver ${RESOLVER}"

norm() {
  tr 'A-Z' 'a-z' | sed 's/\.$//' | sed '/^$/d' | sort -u
}

echo "dns check: ${DOMAIN}"

echo "expected nameservers"
expected=$(printf '%s\n' ${EXPECTED_NS} | norm)
echo "$expected" | sed 's/^/  /'

echo "observed nameservers (${RESOLVER})"
observed=$(dig +short NS "${DOMAIN}" "@${RESOLVER}" | norm)
if [ -z "$observed" ]; then
  echo "  <none>"
else
  echo "$observed" | sed 's/^/  /'
fi

echo "apex A"
a_records=$(dig +short A "${DOMAIN}" "@${RESOLVER}" | grep -E '^[0-9.]+$' || true)
if [ -z "$a_records" ]; then
  echo "  <none>"
else
  echo "$a_records" | sed 's/^/  /'
fi

echo "apex AAAA"
aaaa_records=$(dig +short AAAA "${DOMAIN}" "@${RESOLVER}" | grep -E ':' || true)
if [ -z "$aaaa_records" ]; then
  echo "  <none>"
else
  echo "$aaaa_records" | sed 's/^/  /'
fi

missing=""
for ns in $expected; do
  if ! printf '%s\n' $observed | grep -qxF "$ns"; then
    missing="${missing} ${ns}"
  fi
done

if [ -z "$observed" ]; then
  result="NOT_DELEGATED"
  message="${DOMAIN} resolves no NS records. Add the expected NS records at the parent zone or registrar."
elif [ -n "$missing" ]; then
  result="NOT_DELEGATED_INCOMPLETE"
  message="Delegation is partial. Missing nameserver(s): ${missing}"
else
  result="DELEGATED"
  message="${DOMAIN} resolves to the expected nameservers."
fi

echo "RESULT: ${result}"
echo "  ${message}"
echo "done"
