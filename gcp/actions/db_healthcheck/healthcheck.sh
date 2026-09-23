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

echo "active connections"
psql -c "
SELECT pid, usename, application_name, state, query_start, query
FROM pg_stat_activity
WHERE datname = current_database()
  AND state IS NOT NULL
ORDER BY query_start;
"

echo "lock waits (blocked queries)"
psql -c "
SELECT blocked.pid, blocked.usename, blocked.query AS blocked_query,
  blocking.pid AS blocking_pid, blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE cardinality(pg_blocking_pids(blocked.pid)) > 0;
"

echo "long running queries (over 5 seconds)"
psql -c "
SELECT pid, usename, state,
  round(extract(epoch from now() - query_start)::numeric, 2) AS seconds_running,
  query
FROM pg_stat_activity
WHERE datname = current_database()
  AND state != 'idle'
  AND query_start < now() - interval '5 seconds'
ORDER BY seconds_running DESC;
"

echo "table bloat"
psql -c "
SELECT relname AS table_name,
  n_live_tup AS live_rows,
  n_dead_tup AS dead_rows,
  round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 2) AS dead_row_percent
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
"

echo "done"
