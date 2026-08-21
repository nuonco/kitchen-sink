# Schema + seed for the source database, run by the postgres entrypoint
# exactly once per fresh data dir. Idempotence twice over: the entrypoint only
# runs on an empty PGDATA, and the SQL itself is IF NOT EXISTS /
# ON CONFLICT DO NOTHING so a manual replay is harmless. Pipeline registration
# ships in the same SQL — a pipeline with no runs is due immediately, so the
# first sync lands within seconds of the worker starting.
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "conduit.postgres.name" . }}-init
  namespace: {{ .Values.namespace }}
  labels:
    {{- include "conduit.postgres.labels" . | nindent 4 }}
data:
  01-schema.sql: |
    -- source data (what the operator syncs)
    CREATE TABLE IF NOT EXISTS customers (
      id serial PRIMARY KEY, name text NOT NULL, plan text NOT NULL,
      region text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS orders (
      id serial PRIMARY KEY, customer_id int NOT NULL REFERENCES customers(id),
      amount_cents int NOT NULL, status text NOT NULL, placed_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS events (
      id serial PRIMARY KEY, customer_id int NOT NULL REFERENCES customers(id),
      kind text NOT NULL, occurred_at timestamptz NOT NULL);

    -- the sync engine's own state
    CREATE TABLE IF NOT EXISTS pipelines (
      id serial PRIMARY KEY,
      name text UNIQUE NOT NULL,
      description text NOT NULL DEFAULT '',
      source_tables text[] NOT NULL,
      destination_prefix text NOT NULL,
      interval_seconds int NOT NULL DEFAULT 300,
      paused boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS sync_runs (
      id bigserial PRIMARY KEY,
      pipeline_id int NOT NULL REFERENCES pipelines(id),
      status text NOT NULL CHECK (status IN ('running','succeeded','failed')),
      started_at timestamptz NOT NULL DEFAULT now(),
      finished_at timestamptz,
      rows_copied bigint NOT NULL DEFAULT 0,
      bytes_written bigint NOT NULL DEFAULT 0,
      objects jsonb NOT NULL DEFAULT '[]',   -- ["<s3 key>", ...]
      error text);
    CREATE INDEX IF NOT EXISTS sync_runs_pipeline_idx ON sync_runs (pipeline_id, started_at DESC);
  02-seed.sql: |
    -- Deterministic seed rows: explicit ids + ON CONFLICT DO NOTHING, with the
    -- sequences advanced afterwards so later inserts never collide.
    INSERT INTO customers (id, name, plan, region, created_at)
    SELECT i,
           (ARRAY['Arcline Metals','Bluepeak Analytics','Cardamom Labs','Driftwood Media',
                  'Eastlake Robotics','Fernhill Logistics','Granite Bay Software','Harborlight Health',
                  'Ironvale Systems','Juniper North','Kestrel Dynamics','Larkspur Foods',
                  'Mistral Devices','Northgate Textiles','Opaline Energy','Pinebrook Studios',
                  'Quarry Row','Redshift Freight','Silverthorn Legal','Tidewater Optics',
                  'Umberline Design','Vantage Peak','Willowmere Farms','Xylo Instruments',
                  'Yarrow Supply'])[i],
           (ARRAY['starter','growth','enterprise'])[(i % 3) + 1],
           (ARRAY['us-east-1','us-west-2','eu-west-1','ap-southeast-2'])[(i % 4) + 1],
           now() - (i * 11 || ' days')::interval
    FROM generate_series(1, 25) AS i
    ON CONFLICT DO NOTHING;

    INSERT INTO orders (id, customer_id, amount_cents, status, placed_at)
    SELECT i,
           ((i - 1) % 25) + 1,
           ((i * 733) % 92000) + 500,
           (ARRAY['fulfilled','fulfilled','fulfilled','pending','refunded'])[(i % 5) + 1],
           now() - (i * 9 || ' hours')::interval
    FROM generate_series(1, 60) AS i
    ON CONFLICT DO NOTHING;

    INSERT INTO events (id, customer_id, kind, occurred_at)
    SELECT i,
           ((i * 7) % 25) + 1,
           (ARRAY['login','sync.configured','export.downloaded','api.key.rotated',
                  'plan.upgraded','support.ticket.opened'])[(i % 6) + 1],
           now() - (i * 97 || ' minutes')::interval
    FROM generate_series(1, 90) AS i
    ON CONFLICT DO NOTHING;

    SELECT setval('customers_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM customers), 1));
    SELECT setval('orders_id_seq',    GREATEST((SELECT COALESCE(MAX(id), 1) FROM orders), 1));
    SELECT setval('events_id_seq',    GREATEST((SELECT COALESCE(MAX(id), 1) FROM events), 1));

    -- Pre-registered pipelines. No seeded runs: a pipeline with no runs is due
    -- immediately, so real run history starts the moment the worker does.
    INSERT INTO pipelines (name, description, source_tables, destination_prefix, interval_seconds) VALUES
      ('orders',            'Customers and their orders, for revenue reporting.', ARRAY['customers','orders'], 'orders/',              300),
      ('events',            'The product event stream.',                          ARRAY['events'],             'events/',              600),
      ('customer-snapshot', 'Point-in-time copy of the customers table.',         ARRAY['customers'],          'snapshots/customers/', 900)
    ON CONFLICT (name) DO NOTHING;
