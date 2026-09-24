#!/usr/bin/env sh
# Every query is fatal: assign before emitting, because `nuon_output x "$(...)"`
# hides psql's exit status behind nuon_output's and turns a refused connection
# into six empty outputs and a green step.
set -eu

access="${GOOGLE_OAUTH_ACCESS_TOKEN:-}"
if [ -z "$access" ]; then
  token_json=$(wget -qO- --header='Metadata-Flavor: Google' \
    http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token)
  access=$(printf '%s' "$token_json" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
fi
: "${GCP_DB_SECRET:?}" "${access:?}"
body=$(wget -qO- --header="Authorization: Bearer ${access}" \
  "https://secretmanager.googleapis.com/v1/${GCP_DB_SECRET}:access")
PGPASSWORD=$(printf '%s' "$body" | sed -n 's/.*"data":"\([^"]*\)".*/\1/p' | base64 -d)
export PGPASSWORD
unset token_json access body

: "${PGHOST:?is empty - the cloudsql_instance nested stack output did not resolve}"
: "${PGPORT:?is empty - the cloudsql_instance nested stack output did not resolve}"

echo "connecting to ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
psql -tAXc 'select 1' > /dev/null

# Echo as well as emit, so the values are in the run log and not only the
# action results.
metric() {
  value=$(psql -tAX -c "$2")
  echo "${1} = ${value}"
  nuon_output "$1" "$value"
}

metric server_version  'show server_version'
metric connections     'select count(*) from pg_stat_activity where datname = current_database()'
metric max_connections "select setting from pg_settings where name = 'max_connections'"
metric database_size   'select pg_size_pretty(pg_database_size(current_database()))'
metric cache_hit_ratio 'select coalesce(round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2), 0) from pg_stat_database where datname = current_database()'
metric uptime          "select date_trunc('second', now() - pg_postmaster_start_time())::text"
