-- V0 additive D1 schema for endpoint health.
-- All tables are CREATE TABLE IF NOT EXISTS so this migration is safe to apply
-- repeatedly. No destructive ALTER or DROP is used. This file documents the
-- future production shape; the V0 worker runs against the in-memory adapter
-- and never provisions or connects to D1 resources.

-- One row per created app. IDs are server-generated opaque strings.
CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- One row per environment scoped to an app. An ingest key belongs to exactly
-- one (app_id, environment_id) pair.
CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (app_id) REFERENCES apps (id)
);

-- Stored ingest keys. Only the non-reversible SHA-256 verifier is persisted;
-- the raw key is shown to the operator exactly once at creation time and is
-- never stored. verifier_hash is UNIQUE so key verification is a single lookup.
CREATE TABLE IF NOT EXISTS keys (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  verifier_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);

-- Installation verification state per (app_id, environment_id). Updated on the
-- first accepted batch and on every subsequent batch. Used by the setup view.
CREATE TABLE IF NOT EXISTS installation_status (
  app_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  runtime TEXT,
  first_seen INTEGER,
  last_seen INTEGER,
  PRIMARY KEY (app_id, environment_id)
);

-- Bounded deduplication window for event IDs. A retry of the same event_id
-- within the window is ignored so aggregate counts do not increase twice.
-- Rows are pruned to the dedupe window by a scheduled cleanup; V0 keeps the
-- table small and additive only.
CREATE TABLE IF NOT EXISTS seen_events (
  event_id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  seen_at INTEGER NOT NULL
);

-- One-minute endpoint aggregate buckets. Raw request events are NEVER stored.
-- Each bucket is keyed by (app, environment, minute, method, route) and stores
-- mergeable counts plus a fixed latency histogram serialized as JSON text.
CREATE TABLE IF NOT EXISTS endpoint_buckets (
  app_id TEXT NOT NULL,
  environment_id TEXT NOT NULL,
  bucket_start INTEGER NOT NULL,
  method TEXT NOT NULL,
  route TEXT NOT NULL,
  request_count INTEGER NOT NULL,
  error_count INTEGER NOT NULL,
  duration_sum_ms INTEGER NOT NULL,
  last_seen INTEGER,
  histogram TEXT NOT NULL,
  PRIMARY KEY (app_id, environment_id, bucket_start, method, route)
);

-- Window scans filter by bucket_start; this index keeps those scans bounded.
CREATE INDEX IF NOT EXISTS idx_endpoint_buckets_window
  ON endpoint_buckets (app_id, environment_id, bucket_start);
