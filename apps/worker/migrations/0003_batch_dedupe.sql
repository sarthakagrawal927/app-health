-- One temporary row per SDK batch, replacing one row per request event.
CREATE TABLE IF NOT EXISTS seen_batches (
  batch_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  seen_at INTEGER NOT NULL,
  PRIMARY KEY (app_id, environment_id, batch_id),
  FOREIGN KEY (environment_id, app_id) REFERENCES environments (id, app_id)
);

CREATE INDEX IF NOT EXISTS idx_seen_batches_expiry ON seen_batches (seen_at);

CREATE TABLE IF NOT EXISTS failure_events (
  failure_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  method TEXT NOT NULL,
  route TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  occurred_at INTEGER NOT NULL,
  release TEXT,
  PRIMARY KEY (app_id, environment_id, failure_id),
  FOREIGN KEY (environment_id, app_id) REFERENCES environments (id, app_id)
);

CREATE INDEX IF NOT EXISTS idx_failure_events_expiry ON failure_events (occurred_at);
