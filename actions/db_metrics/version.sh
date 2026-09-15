#!/usr/bin/env sh
set -eu

: "${PGHOST:?is empty - the rds_instance nested stack output did not resolve}"
: "${PGPORT:?is empty - the rds_instance nested stack output did not resolve}"

psql -tAXc 'select version()'
