# app-health — PROJECT STATUS

Last updated: 2026-07-21

## Why / What

App Health V0 gives a Go or Node application an ingest key and shows how every observed endpoint is performing.

**Users:** A developer or operator who wants immediate endpoint health after installing one small SDK.

**IN scope:** App/environment creation, one ingest key, Express and Go `net/http` middleware, asynchronous endpoint summaries, aggregate-only storage, and a 15-minute/1-hour/24-hour observed-endpoint performance table.

**OUT of scope:** Unobserved source-route discovery, Problems/incidents, raw logs, request or response content, user identity, traces, AI, alerts, deployment recovery, GitHub installation, teams/roles, and billing.

## Dependencies

### External

- Cloudflare Worker, D1 control-plane storage, Workers Analytics Engine telemetry, and Cloudflare Access are the approved production architecture. The dedicated APAC D1 resource exists; Worker deployment, Access, analytics query credentials, and canary acceptance are in progress.
- Node 20+ with Express and Go 1.22+ with `net/http` are the supported V0 runtime surfaces.

### Internal

- None.

## Timeline

- 2026-07-20 — project scaffolded
- 2026-07-20 — MVP PRD converted into OpenSpec proposal, capability specs, technical design, and implementation waves
- 2026-07-20 — broad MVP deferred; endpoint-only Go + Node V0 made the active build target
- 2026-07-20 — reviewed V0 workspace, shared contracts, local seeded adapter, and TypeScript/Go CI foundation landed
- 2026-07-20 — merged the local Wave 1 backend: scoped one-time ingest keys, aggregate-only idempotent ingest, fixed histograms, installation status, endpoint-window queries, and fail-closed non-local owner APIs
- 2026-07-20 — merged bounded Node/Express and Go `net/http` SDKs with asynchronous batching, timeout/retry/drop behavior, privacy-exclusion tests, benchmarks, and credential-free runnable examples; clean-install TypeScript checks, 39 Go tests, Go vet, and strict OpenSpec validation pass
- 2026-07-20 — completed the local endpoint dashboard, all six desktop/mobile state captures, and Node/Go example proofs through the real local ingest/query path; full workspace checks, 44 Go tests, Go vet, SDK benchmarks, and strict OpenSpec validation pass
- 2026-07-21 — implemented the deploy-ready Cloudflare path: transactional D1 control plane, bounded dedupe cleanup, aggregate-only Analytics Engine writes and sampling-aware queries, Access JWT owner verification, separate dashboard/ingest host enforcement, existing-app recovery, static asset routing, and fail-closed production configuration; repository and Go checks plus strict OpenSpec validation pass
- 2026-07-21 — received production approval, created the dedicated APAC D1 control plane, and added pinned Wrangler tooling plus guarded migration/deploy entrypoints and custom-domain configuration

## Products

- Private GitHub repository and local development checkout.
- Local implemented surfaces: operator web application, Cloudflare-compatible ingest/API service, Node SDK, and Go SDK.

## Features (shipped)

- **Development foundation:** pnpm TypeScript workspace plus Go 1.22 module, versioned runtime-validated endpoint contracts, equivalent Node/Go fixtures, local seeded Worker adapter, and green TypeScript/Go CI.
- **Cloudflare production implementation:** D1 owns apps/environments/hashed keys/install state/bounded dedupe; Workers Analytics Engine owns sampled endpoint telemetry; Access JWT validation protects owner routes; `workers.dev` is disabled; `health.sassmaker.com` and `ingest.health.sassmaker.com` are the approved boundaries. The D1 resource and versioned deploy configuration are provisioned; Access, the analytics query secret, deployment, and canary remain release steps.
- **Node SDK:** optional Express middleware and bounded fail-open delivery with privacy, outage, retry, overflow, shutdown, and benchmark coverage.
- **Go SDK:** `net/http` middleware and bounded fail-open delivery with route-pattern/resolver support, response-behavior coverage, privacy/outage/retry/overflow/close tests, and benchmark coverage.
- **Operator dashboard:** local app/key setup, one-time key handoff, Node/Go snippets, installation states, stable endpoint sorting, 15-minute/1-hour/24-hour metrics, responsive table/cards, explicit health thresholds, and reviewed desktop/mobile states.
- **End-to-end local proof:** the Express and Go examples each sent `/health`, `/users/:id`, and `/orders` through the same local ingest and query APIs used by the dashboard; both runtimes reached connected state and the aggregates updated.

## Todo / Planned / Deferred / Blocked

1. **Deferred:** the broader owner-first Problem workflow in `build-app-health-mvp` until the endpoint V0 earns expansion.
2. **Production cutover:** deployment approval is recorded. Complete the Access issuer/audience/owner policy and read-scoped Analytics Engine query token, apply the first D1 migration, deploy both approved custom hostnames, and run the Node/Go canary.
3. **Verification:** the injected-failure D1, Access identity, host-boundary,
   ingest-without-Access, body-limit, no-store, and missing-binding matrices are
   covered locally. Production resource provisioning and the real canary remain
   the only open change tasks.
