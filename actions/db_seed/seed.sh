#!/usr/bin/env sh
set -eu

echo "connecting to ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
psql -tAXc 'select 1' > /dev/null

echo "creating users table"
psql -tAXc "
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  status     TEXT NOT NULL,
  plan       TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
"

echo "seeding 50 users"
psql -tAXc "
INSERT INTO users (name, email, status, plan, created_at)
SELECT
  'User ' || i,
  'user' || i || '@example.com',
  (ARRAY['active','inactive','pending'])[floor(random()*3+1)],
  (ARRAY['free','pro','enterprise'])[floor(random()*3+1)],
  now() - (random() * interval '365 days')
FROM generate_series(1, 50) AS i;
"

metric() {
  value=$(psql -tAX -c "$2")
  echo "${1} = ${value}"
  nuon_output "$1" "$value"
}

metric row_count             'SELECT count(*) FROM users'
metric table_size            'SELECT pg_size_pretty(pg_total_relation_size('"'"'users'"'"'))'
metric column_count          'SELECT count(*) FROM information_schema.columns WHERE table_name = '"'"'users'"'"''
metric active_users          'SELECT count(*) FROM users WHERE status = '"'"'active'"'"''
metric inactive_users        'SELECT count(*) FROM users WHERE status = '"'"'inactive'"'"''
metric pending_users         'SELECT count(*) FROM users WHERE status = '"'"'pending'"'"''
metric free_plan_users       'SELECT count(*) FROM users WHERE plan = '"'"'free'"'"''
metric pro_plan_users        'SELECT count(*) FROM users WHERE plan = '"'"'pro'"'"''
metric enterprise_plan_users 'SELECT count(*) FROM users WHERE plan = '"'"'enterprise'"'"''
metric server_version        'SHOW server_version'
metric database_size         'SELECT pg_size_pretty(pg_database_size(current_database()))'

echo "done"
