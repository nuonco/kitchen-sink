#!/usr/bin/env sh
set -eu

token_json=$(wget -qO- --header='Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token)
access=$(printf '%s' "$token_json" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
: "${GCP_DB_SECRET:?}" "${access:?}"
body=$(wget -qO- --header="Authorization: Bearer ${access}" \
  "https://secretmanager.googleapis.com/v1/${GCP_DB_SECRET}:access")
PGPASSWORD=$(printf '%s' "$body" | sed -n 's/.*"data":"\([^"]*\)".*/\1/p' | base64 -d)
export PGPASSWORD
unset token_json access body

echo "connecting to ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
psql -tAXc 'select 1' > /dev/null

echo "tables in database"
psql -c "\dt"

echo "columns in users table"
psql -c "\d users"

echo "done"
