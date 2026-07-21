-- Durable normalized endpoint identities prevent Analytics Engine sampling
-- from erasing rare routes from the operator inventory. This table stores no
-- request event, status, duration, payload, query value, header, or identity.
CREATE TABLE IF NOT EXISTS observed_endpoints (
  app_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  method TEXT NOT NULL,
  route TEXT NOT NULL,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  PRIMARY KEY (app_id, environment_id, method, route),
  FOREIGN KEY (environment_id, app_id) REFERENCES environments (id, app_id)
);

CREATE INDEX IF NOT EXISTS idx_observed_endpoints_environment
  ON observed_endpoints (app_id, environment_id, method, route);
