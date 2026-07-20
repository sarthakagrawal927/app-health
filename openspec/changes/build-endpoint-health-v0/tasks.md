## 1. Repository and contract foundation (Wave 0, one Devin agent)

- [ ] 1.1 Create a pnpm TypeScript workspace with `apps/web`, `apps/worker`, `packages/contracts`, and `packages/node`, plus `packages/go` as a Go 1.22 module.
- [ ] 1.2 Add root and package-local format/lint, typecheck, test, and build commands with a checked-in pnpm lockfile and functional CI for both TypeScript and Go.
- [ ] 1.3 Define the runtime-validated v1 event batch, endpoint aggregate, app/key, installation status, and endpoint query contracts with canonical Node and Go fixtures.
- [ ] 1.4 Add a credential-free in-memory development adapter and seeded endpoint metrics without implementing production resources.
- [ ] 1.5 Document architecture, exact local commands, minimal dependency rationale, observed-endpoint semantics, and the no-deploy/no-production-auth boundary.

## 2. Project key and endpoint ingestion (Wave 1A, backend Devin agent)

- [ ] 2.1 Add additive D1 schema and repository interfaces for apps, environments, key verifiers, installation status, deduplication, and one-minute endpoint aggregate buckets.
- [ ] 2.2 Implement local owner identity, app creation, one-time key display, non-reversible key verification, and key revocation; fail owner APIs closed outside local mode without an identity adapter.
- [ ] 2.3 Implement authenticated v1 batch ingest with field bounds, schema validation, clock-skew checks, idempotent event handling, and no raw-event persistence.
- [ ] 2.4 Implement fixed latency histograms, one-minute aggregation, window merging, p50/p95 approximation, error rate, last seen, and deterministic health-state calculation.
- [ ] 2.5 Implement installation-status and 15-minute, 1-hour, and 24-hour endpoint query APIs with project/environment isolation.
- [ ] 2.6 Add backend tests for invalid/revoked keys, unsafe/unknown fields, duplicate events, histogram merging, threshold edges, environment isolation, empty traffic, and non-local auth failure.

## 3. Node SDK (Wave 1B, Node Devin agent)

- [ ] 3.1 Implement the minimal `@app-health/node` client and Express middleware using the v1 contract.
- [ ] 3.2 Capture method, framework route template, status, duration, timestamp, and optional release after response completion, with conservative numeric/UUID fallback normalization.
- [ ] 3.3 Implement bounded asynchronous batching, short timeouts, bounded retries, queue-pressure drops, graceful flush, and local diagnostic counters.
- [ ] 3.4 Prove serialized batches never contain headers, cookies, query values, parameter values, bodies, identity, logs, stacks, or spans.
- [ ] 3.5 Add Express behavior, route normalization, status/error, ingest-outage, retry, overflow, shutdown, and request-content exclusion tests plus a small overhead benchmark.
- [ ] 3.6 Add a runnable Express example that uses a supplied key and local ingest URL without committing any key or env file.

## 4. Go SDK (Wave 1C, Go Devin agent)

- [ ] 4.1 Implement idiomatic `net/http` middleware and client configuration in `packages/go` using the v1 contract.
- [ ] 4.2 Capture method, Go 1.22 request pattern or route-resolver value, status, duration, timestamp, and optional release with conservative fallback normalization.
- [ ] 4.3 Preserve handler response behavior and supported optional interfaces while implementing bounded asynchronous delivery, timeouts, retries, overflow drops, and close/flush.
- [ ] 4.4 Prove serialized batches never contain headers, cookies, query values, concrete path values when a pattern exists, bodies, identity, logs, stacks, or spans.
- [ ] 4.5 Add ServeMux, custom status/body, optional-interface, panic, resolver, normalization, outage, retry, overflow, close, and request-content exclusion tests plus a benchmark.
- [ ] 4.6 Add a runnable Go example that uses a supplied key and local ingest URL without committing any key or env file.

## 5. Endpoint dashboard (Wave 2, dashboard Devin agent)

- [ ] 5.1 Implement the Vite/React local operator flow to create an app, display the key once, and show Node and Go install snippets.
- [ ] 5.2 Implement installation states for waiting, connected, stale, revoked/invalid key, and temporary API failure with a concrete next action.
- [ ] 5.3 Implement a cohesive, polished visual system and the observed-endpoint table with method/route, request count, error rate, p50, p95, last seen, health state, refresh time, and 15-minute/1-hour/24-hour selection.
- [ ] 5.4 Implement stable sorting by health, requests, error rate, p95, and last seen, with visible metric/threshold explanations, accessible contrast/focus behavior, and an intentional narrow-screen card/list layout.
- [ ] 5.5 Add UI tests for project setup, one-time key behavior, no-traffic, populated windows, low-volume state, sorting, stale data, and API failure.
- [ ] 5.6 Capture and check in six current browser screenshots: desktop and mobile views for setup, waiting-for-traffic, and populated endpoint states, without deploying.

## 6. End-to-end proof and handoff (Wave 3, parent review)

- [ ] 6.1 Run one Express example through local ingest and verify its observed endpoints and metrics in the dashboard.
- [ ] 6.2 Run one Go example through local ingest and verify its observed endpoints and metrics in the same dashboard.
- [ ] 6.3 Prove both SDKs fail open during ingest outage and remain within their documented benchmark budgets.
- [ ] 6.4 Run full format/lint, typecheck, TypeScript tests, Go tests, builds, OpenSpec validation, and `git diff --check` from a clean install.
- [ ] 6.5 Review dependencies, public SDK APIs, privacy exclusions, tenant/environment scope, raw-event absence, and the non-local owner-auth fail-closed path.
- [ ] 6.6 Review all six screenshots for hierarchy, density, responsive behavior, accessibility, and visual finish; send dashboard fixes back before acceptance.
- [ ] 6.7 Update `PROJECT_STATUS.md` with only verified shipped behavior, archive the V0 OpenSpec change when complete, and leave production auth/deployment as explicit later work.
