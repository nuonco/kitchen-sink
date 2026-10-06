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
FROM generate_series(1, 50) AS i
WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1);
"

output=$(psql -tAX -c "
SELECT json_build_object(
  'row_count',             count(*),
  'active_users',          count(*) FILTER (WHERE status = 'active'),
  'inactive_users',        count(*) FILTER (WHERE status = 'inactive'),
  'pending_users',         count(*) FILTER (WHERE status = 'pending'),
  'free_plan_users',       count(*) FILTER (WHERE plan = 'free'),
  'pro_plan_users',        count(*) FILTER (WHERE plan = 'pro'),
  'enterprise_plan_users', count(*) FILTER (WHERE plan = 'enterprise')
) FROM users;
")

echo "$output"
echo "$output" >> "$NUON_ACTIONS_OUTPUT_FILEPATH"

echo "done"
