## Why

App Health already proves the complete key-to-SDK-to-dashboard flow locally,
but it cannot serve that flow outside local mode because its Worker has no
production persistence, analytics binding, or owner identity boundary. The
smallest useful next step is to deploy that exact endpoint-health product on
Cloudflare without expanding into traces, incidents, logs, or a general
observability platform.

## What Changes

- Add a production Cloudflare Worker that serves the private operator UI and
  owner APIs while leaving only the ingest endpoint non-interactive.
- Store apps, environments, and SHA-256 key verifiers in D1; raw ingest keys are
  displayed once and never persisted.
- Write aggregate-safe endpoint telemetry to Workers Analytics Engine instead
  of building a custom metrics database.
- Query 15-minute, 1-hour, and 24-hour endpoint summaries through fixed,
  sampling-aware Analytics Engine SQL.
- Validate Cloudflare Access identity for every owner route while preserving
  bearer-key authentication for `/v1/ingest`.
- Keep the local in-memory adapter and credential-free test path.
- Add guarded deployment configuration and a production canary for create app
  → issue key → ingest traffic → view data.
- Keep Web Analytics, traces, logs, request content, identity, alerts, billing,
  teams, and long-term retention outside this product.

## Capabilities

### New Capabilities

- `cloudflare-production-runtime`: Cloudflare Worker, D1, Analytics Engine,
  Access, static assets, deployment configuration, and production canary.

### Modified Capabilities

- `project-key-setup`: Production owner identity, durable app/environment
  creation, one-time raw-key handoff, and existing-app selection.
- `endpoint-ingestion`: Production D1-backed key verification and
  aggregate-safe Analytics Engine writes.
- `endpoint-dashboard`: Sampling-aware production queries and connected-state
  behavior backed by Analytics Engine.

## Impact

- Affects the Worker route layer, repository adapters, service layer, D1
  migration, web setup/dashboard flow, SDK endpoint examples, Wrangler
  configuration, tests, OpenSpec contracts, and project status.
- Adds Cloudflare D1 and Workers Analytics Engine bindings plus Cloudflare
  Access configuration. Querying Analytics Engine from the Worker requires an
  account identifier and a read-scoped API token supplied as deployment-time
  configuration; no value is committed.
- Does not change the public SDK event privacy schema or add a production
  dependency.
- Confirmed hostnames: private dashboard `health.sassmaker.com`; SDK ingest
  `ingest.health.sassmaker.com`.
