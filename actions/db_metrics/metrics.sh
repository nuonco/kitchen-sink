#!/usr/bin/env sh
# Every query is fatal: assign before emitting, because `nuon_output x "$(...)"`
# hides psql's exit status behind nuon_output's and turns a refused connection
# into six empty outputs and a green step.
set -eu

: "${PGHOST:?is empty - the rds_instance nested stack output did not resolve}"
: "${PGPORT:?is empty - the rds_instance nested stack output did not resolve}"

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
