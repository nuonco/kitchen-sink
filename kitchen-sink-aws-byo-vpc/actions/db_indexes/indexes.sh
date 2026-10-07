#!/usr/bin/env sh
set -eu

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
