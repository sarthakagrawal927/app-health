-- Browser (public-key) application logs.
-- `source` distinguishes server facts from browser claims. Public log keys are
-- pinned to one environment and an origin allowlist; only the verifier hash is
-- stored. browser_log_quota holds per-key per-minute counters, pruned hourly.
ALTER TABLE log_events ADD COLUMN source TEXT NOT NULL DEFAULT 'server';

CREATE TABLE IF NOT EXISTS public_log_keys (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  verifier_hash TEXT NOT NULL UNIQUE,
  allowed_origins TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (environment_id, app_id) REFERENCES environments (id, app_id)
);

CREATE INDEX IF NOT EXISTS idx_public_log_keys_app ON public_log_keys (app_id, created_at);

CREATE TABLE IF NOT EXISTS browser_log_quota (
  key_id TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_browser_log_quota_expiry ON browser_log_quota (window_start);
