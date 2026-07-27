-- Additive product-scoped ingest keys. Existing environment-scoped keys remain
-- untouched in `keys` and continue to work during migration.
CREATE TABLE IF NOT EXISTS product_keys (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  verifier_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (app_id) REFERENCES apps (id)
);

CREATE INDEX IF NOT EXISTS idx_product_keys_app
  ON product_keys (app_id, created_at);

-- One durable environment name per product lets product-key telemetry safely
-- find-or-create an environment without duplicate rows under concurrency.
CREATE UNIQUE INDEX IF NOT EXISTS idx_environments_app_name
  ON environments (app_id, name);
