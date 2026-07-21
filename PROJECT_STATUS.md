# app-health — PROJECT STATUS

Last updated: 2026-07-21

## Why / What

App Health V0 gives a Go or Node application an ingest key and shows how every observed endpoint is performing.

**Users:** A developer or operator who wants immediate endpoint health after installing one small SDK.

**IN scope:** App/environment creation, one ingest key, Express, Echo, and Go `net/http` middleware, asynchronous endpoint summaries, aggregate-only storage, and a 15-minute/1-hour/24-hour observed-endpoint performance table.

**OUT of scope:** Unobserved source-route discovery, Problems/incidents, raw logs, request or response content, user identity, traces, AI, alerts, deployment recovery, GitHub installation, teams/roles, and billing.

## Dependencies

### External

- Cloudflare Worker, D1 control-plane plus normalized endpoint inventory, Workers Analytics Engine telemetry, and a dedicated single-owner Worker secret are the production architecture. The Worker, APAC D1 resource, secrets, both custom hostnames, and corrected Node/Go canary are live on the existing Workers subscription. No additional Cloudflare subscription is approved.
- Node 20+ with Express and Go 1.22+ with Echo or `net/http` are the supported V0 runtime surfaces.

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
- 2026-07-21 — rejected Zero Trust activation because its free checkout required standing overage authorization; replaced Access with a timing-safe owner Worker secret and an in-memory-only dashboard unlock flow so the release adds no Cloudflare subscription
- 2026-07-21 — deployed the Worker, D1 schema, owner/query secrets, and `health.sassmaker.com` plus `ingest.sassmaker.com`; Node and Go canaries connected successfully and exposed an Analytics Engine sampling edge where rare endpoint identities could disappear
- 2026-07-21 — added a privacy-bounded normalized D1 endpoint inventory and explicit sampled-metrics UI so every accepted endpoint remains visible without inventing zero values
- 2026-07-21 — applied the additive production migration and deployed Worker version `81eae678-6774-4229-9136-064e7ff3ecb5`; the corrected canary sent three Node and four Go events with no delivery failures, reached connected state, and returned all five observed routes
- 2026-07-21 — made the Node SDK release-ready as `@saas-maker/app-health` with ESM/CommonJS/types and external tarball proofs; added the Go 1.22-compatible Echo adapter, public framework record API, private-module install path, and route/error/panic/privacy/outage integration coverage
- 2026-07-21 — reduced D1 dedupe from one row per request to one row per SDK batch; retained parameter-free 4xx/5xx details for 24 hours while all requests remain histogram-aggregated for pXX metrics

## Products

- Private GitHub repository and local development checkout.
- Local implemented surfaces: operator web application, Cloudflare-compatible ingest/API service, Node SDK, and Go SDK.

## Features (shipped)

- **Development foundation:** pnpm TypeScript workspace plus Go 1.22 module, versioned runtime-validated endpoint contracts, equivalent Node/Go fixtures, local seeded Worker adapter, and green TypeScript/Go CI.
- **Cloudflare production implementation:** D1 owns apps/environments/hashed keys/install state/bounded dedupe and only normalized endpoint identity plus first/last seen; Workers Analytics Engine owns sampled performance telemetry; a timing-safe owner Worker secret protects owner APIs; the dashboard retains that secret only in page memory; `workers.dev` is disabled; `health.sassmaker.com` and `ingest.sassmaker.com` are live boundaries.
- **Node SDK:** publishable `@saas-maker/app-health` core plus `/express` adapter and bounded fail-open delivery with privacy, outage, retry, overflow, shutdown, package-consumer, and benchmark coverage.
- **Go SDK:** real private GitHub module with `net/http` and `/echo` middleware, a bounded adapter record API, route-pattern/resolver support, response/error/panic preservation, privacy/outage/retry/overflow/close tests, and benchmark coverage.
- **Operator dashboard:** local app/key setup, one-time key handoff, verified Express/Echo snippets, installation states, stable endpoint sorting, 15-minute/1-hour/24-hour metrics, responsive table/cards, explicit health thresholds, and reviewed desktop/mobile states.
- **End-to-end local proof:** the Express and Go examples each sent `/health`, `/users/:id`, and `/orders` through the same local ingest and query APIs used by the dashboard; both runtimes reached connected state and the aggregates updated.
- **Storage-bounded ingest:** retry-stable batch IDs reduce temporary D1 dedupe rows by up to 100× at the default batch size; successful requests stay aggregate-only and individual 4xx/5xx details expire after 24 hours.

## Todo / Planned / Deferred / Blocked

1. **Deferred:** the broader owner-first Problem workflow in `build-app-health-mvp` until the endpoint V0 earns expansion.
2. **Verification:** the injected-failure D1, owner identity, host-boundary,
   ingest-without-owner-auth, body-limit, no-store, binding-absence, sampled-route,
   and browser non-persistence matrices are covered locally. The live dashboard
   is connected and the production endpoint inventory is accepted.
