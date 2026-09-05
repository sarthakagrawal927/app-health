-- Owner-authored application logs (signups, waitlist joins, payment failures).
-- Opt-in: rows exist only when an application explicitly POSTs /v1/logs.
-- Additive and idempotent. Rows older than LOG_RETENTION_DAYS are pruned by the
-- hourly scheduled cleanup.
CREATE TABLE IF NOT EXISTS log_events (
  log_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  event TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  title TEXT,
  description TEXT,
  icon TEXT,
  props TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (app_id, environment_id, log_id),
  FOREIGN KEY (environment_id, app_id) REFERENCES environments (id, app_id)
);

CREATE INDEX IF NOT EXISTS idx_log_events_scope_time
  ON log_events (app_id, environment_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_log_events_expiry ON log_events (timestamp);
