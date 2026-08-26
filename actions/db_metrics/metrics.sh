#!/usr/bin/env sh
set -eu

q() {
  psql -tAX -c "$1" | tr -d '\n'
}

nuon_output server_version "$(q 'show server_version')"
nuon_output connections "$(q 'select count(*) from pg_stat_activity where datname = current_database()')"
nuon_output max_connections "$(q "select setting from pg_settings where name = 'max_connections'")"
nuon_output database_size "$(q 'select pg_size_pretty(pg_database_size(current_database()))')"
nuon_output cache_hit_ratio "$(q 'select coalesce(round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2), 0) from pg_stat_database where datname = current_database()')"
nuon_output uptime "$(q "select date_trunc('second', now() - pg_postmaster_start_time())::text")"
