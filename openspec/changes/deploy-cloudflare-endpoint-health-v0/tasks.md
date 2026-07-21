## 1. Production contract and adapters

- [x] 1.1 Reconcile the D1 migration so apps, environments, key verifiers, installation state, and bounded event deduplication are durable while endpoint telemetry is excluded
- [x] 1.2 Implement the D1 repository adapter with transactional app and environment creation, key revocation, installation updates, and expired-dedup cleanup
- [x] 1.3 Implement injectable Analytics Engine writer and query adapters with a stable opaque app-environment index and fixed approved dimensions
- [x] 1.4 Add a bounded request-body guard before ingest JSON parsing and aggregate valid batches to no more than 250 Analytics Engine points per invocation
- [x] 1.5 Add sampling-aware fixed-window SQL and merge weighted histogram buckets into request count, error rate, approximate p50 and p95, and last-seen summaries

## 2. Identity and route boundaries

- [x] 2.1 Implement Cloudflare Access JWT verification for issuer, audience, signature, expiry, and the single-owner allowlist
- [x] 2.2 Require verified owner identity on every owner API and dashboard route outside explicit local mode while keeping ingest bearer-key authenticated
- [x] 2.3 Route API requests before static assets, serve the dashboard SPA from the Worker, and apply no-store headers to key and owner responses
- [x] 2.4 Configure production mode to fail closed when D1, Analytics Engine, query credentials, Access configuration, or the ingest origin is unavailable
- [x] 2.5 Protect or disable the direct workers.dev hostname and codify the approved dashboard and ingest hostname topology

## 3. Product flow

- [x] 3.1 Add durable existing-app and environment listing and selection for a fresh authenticated browser session
- [x] 3.2 Preserve the one-time raw-key setup state without persisting the key in browser storage, logs, or analytics
- [x] 3.3 Render Node and Go installation snippets against the configured ingest origin
- [x] 3.4 Connect the production dashboard windows and installation states to Analytics Engine queries while labeling sampled percentiles approximate
- [x] 3.5 Preserve the local in-memory flow and credential-free examples independently of production bindings

## 4. Verification and release guard

- [x] 4.1 Add D1 adapter tests for transactional creation, scoped verification, revocation, deduplication, expiry cleanup, and injected failures
- [x] 4.2 Add Analytics Engine tests for privacy exclusions, point aggregation and limits, fixed SQL, sampling weights, histogram merging, and app-environment isolation
- [x] 4.3 Add Access and routing tests for forged assertions, absent identity, ingest without Access cookies, direct-host bypass, body limits, no-store responses, and missing bindings
- [x] 4.4 Run the full TypeScript and Go checks plus strict OpenSpec validation and update PROJECT_STATUS.md with the verified production-readiness state
- [ ] 4.5 With explicit deployment approval, provision the approved Cloudflare bindings and routes without committing secret values
- [ ] 4.6 Run and record the production canary for app creation, one-time key handoff, Node ingest, Go ingest, connected state, endpoint summaries, and prohibited-data absence
