#!/usr/bin/env sh
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

echo "connecting to ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
psql -tAXc 'select 1' > /dev/null

echo "indexes in database"
psql -c "
SELECT
  t.relname   AS table_name,
  i.relname   AS index_name,
  a.attname   AS column_name,
  pg_size_pretty(pg_relation_size(i.oid)) AS index_size,
  ix.indisunique AS is_unique,
  s.idx_scan  AS times_used
FROM
  pg_class t
  JOIN pg_index ix ON t.oid = ix.indrelid
  JOIN pg_class i  ON i.oid = ix.indexrelid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
  LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = i.oid
WHERE
  t.relkind = 'r'
  AND t.relname NOT LIKE 'pg_%'
  AND t.relname NOT LIKE 'sql_%'
ORDER BY
  t.relname, i.relname;
"

echo "done"
