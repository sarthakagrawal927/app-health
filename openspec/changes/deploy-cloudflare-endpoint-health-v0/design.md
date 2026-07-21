## Context

The repository contains a complete local endpoint-health flow: one-time ingest
keys, Node and Go SDKs, aggregate-only ingest, installation status, and a
responsive endpoint table. Production mode currently fails closed because the
Worker only constructs an in-memory adapter in explicit local mode.

The production product has one operator. It does not need accounts, teams,
billing, traces, incidents, logs, or another general analytics platform.
Cloudflare should own the runtime and time-series substrate. The existing event
privacy contract remains authoritative.

Workers Analytics Engine is designed for custom high-cardinality metrics, can
be written through a Worker binding without an application secret, and is
queried through sampling-aware SQL. It retains data for three months and may
sample high-volume indexes, so App Health must describe its metrics as
approximate.

## Goals / Non-Goals

**Goals:**

- Deploy one private operator surface that creates an app/environment and shows
  the raw ingest key exactly once.
- Let Node and Go SDKs post aggregate-safe endpoint events with only that key.
- Make first valid traffic visible within 30 seconds.
- Keep durable control-plane state in D1 and telemetry in Analytics Engine.
- Preserve local credential-free development and the existing privacy tests.
- Fail closed when owner identity, D1, analytics bindings, or query credentials
  are absent in production.

**Non-Goals:**

- Cloudflare Web Analytics, browser RUM, traces, raw logs, payloads, identity,
  alerting, incident management, source-route discovery, teams, billing,
  public signup, or retention beyond Analytics Engine's product window.
- Replacing Cloudflare's own account-level analytics or the separate Fleet
  performance product.
- Automatic deployment, DNS mutation, Access policy mutation, or secret
  creation from repository code.

## Decisions

### D1 owns only the control plane

D1 stores apps, environments, SHA-256 ingest-key verifiers, revocation state,
installation first/last seen timestamps, runtime, and bounded event-ID
deduplication. It does not store method, route, status, duration, histograms, or
other endpoint telemetry.

The pre-production migration is reconciled before first deploy by removing the
unused endpoint bucket table. If any remote database has already received the
migration, an additive migration is required instead of rewriting history.

### Analytics Engine owns endpoint telemetry

The Worker validates a batch and aggregates equivalent events in memory before
calling `writeDataPoint()`. Each point uses:

- index: a stable, opaque app/environment scope identifier under the Analytics
  Engine index limit;
- blobs: method, normalized route, latency bucket, runtime, optional release;
- doubles: request count, error count, duration sum, and maximum event
  timestamp.

No event ID, concrete path, header, query value, body, user identity, log,
stack, or trace is written. The Worker writes no more than 250 points in one
invocation and rejects oversized/invalid batches before any durable write.

Queries use a static dataset name, an allowlisted window, and the resolved
app/environment index. SQL groups approved dimensions and multiplies counts and
sums by `_sample_interval`. The Worker merges returned histogram buckets to
derive approximate p50/p95 and deterministic health states. User input never
becomes a SQL identifier.

### Access protects owner routes; ingest remains key-authenticated

Every owner route validates a Cloudflare Access JWT against the configured
issuer, audience, JWKS, and single-owner allowlist. The raw Access assertion is
never returned or logged. Production does not trust a mere email header.

`/v1/ingest` remains outside interactive Access and accepts only a scoped bearer
key. The preferred routing is a dedicated ingest hostname mapped to the same
Worker, because an exact Access bypass policy is easier to misconfigure and
removes Access logging for that path. The approved topology is
`health.sassmaker.com` for the Access-protected owner surface and
`ingest.health.sassmaker.com` for key-authenticated SDK traffic.

The `workers.dev` route must be disabled or enforce the same JWT checks so it
cannot bypass Access.

### One Worker serves API and web assets

The Vite dashboard is built as static assets and served by the Worker. API
routes are handled first; unmatched GET requests fall back to the SPA. Owner
responses, especially app creation, use `Cache-Control: no-store`. The SDK
snippet uses a configured ingest origin rather than `window.location.origin`.

### Local behavior remains independent

`APP_HEALTH_MODE=local` continues to use the in-memory adapter and local owner.
Production bindings are selected only outside local mode. Unit and end-to-end
tests inject D1, Analytics Engine, JWT, and SQL clients without credentials.

## Risks / Trade-offs

- **Analytics Engine is approximate and sampled** → Weight every query by
  `_sample_interval`, preserve fixed histogram buckets, and label percentile
  output approximate.
- **Analytics Engine query API needs a read token** → Store it only as a Worker
  secret, use the narrow Account Analytics Read permission, and fail closed
  when absent.
- **Access can accidentally block SDK ingest** → Prefer a separate ingest
  hostname; otherwise test exact path-policy precedence before release.
- **Access can be bypassed through `workers.dev`** → Disable the route or retain
  Worker-side JWT verification on every owner request.
- **D1 setup can partially create records** → Use a transactional D1 batch and
  test injected failures.
- **Deduplication creates write load** → Keep event-ID rows bounded by the SDK
  retry window and remove expired rows with a scheduled, bounded cleanup.
- **Analytics writes are non-blocking** → Treat an accepted ingest response as
  validation/key acceptance, not immediate query durability; retain the
  30-second connected-state allowance.

## Migration Plan

1. Land and verify the D1 adapter, Analytics Engine writer/query builder,
   Access validator, assets routing, and local compatibility without creating
   remote resources.
2. Run Wrangler configuration validation and local D1 migrations.
3. With explicit production approval, create/bind D1, configure Analytics
   Engine, add the read-scoped query secret, and configure Access/routing.
4. Deploy to the chosen hostname with `workers.dev` protected or disabled.
5. Run the production canary: create app → copy key → send Node and Go traffic
   → observe connected state and endpoint aggregates.
6. Roll back the Worker version on failure. D1 metadata remains additive and
   Analytics Engine data is disposable telemetry; no customer migration is
   required while there is one operator.

## Open Questions

None. The owner approved Workers Analytics Engine and the separate dashboard
and ingest hostnames on 2026-07-21.
