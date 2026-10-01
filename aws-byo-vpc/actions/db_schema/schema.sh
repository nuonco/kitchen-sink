#!/usr/bin/env sh
set -eu

echo "connecting to ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
psql -tAXc 'select 1' > /dev/null

echo "tables in database"
psql -c "\dt"

echo "columns in users table"
psql -c "\d users"

echo "done"
