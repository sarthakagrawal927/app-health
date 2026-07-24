# app-health — PROJECT STATUS

Last updated: 2026-07-25

## Why / What

App Health V0 gives a service an ingest key and shows how every observed endpoint is performing.

**Users:** A developer or operator who wants immediate endpoint health after installing one small SDK or connecting an existing OpenTelemetry pipeline.

**IN scope:** App/environment creation, one ingest key, Express, Echo, Go `net/http`, and OTLP/HTTP trace projection, asynchronous endpoint summaries, aggregate-only storage, and a 15-minute/1-hour/24-hour observed-endpoint performance table.

**OUT of scope:** Unobserved source-route discovery, Problems/incidents, raw logs, stored trace exploration, request or response content, user identity, AI, alerts, deployment recovery, GitHub installation, teams/roles, and billing.

## Dependencies

### External

- Cloudflare Worker, D1 control-plane plus normalized endpoint inventory, Workers Analytics Engine telemetry, and a dedicated single-owner Worker secret are the production architecture. The Worker, APAC D1 resource, secrets, both custom hostnames, and corrected Node/Go canary are live on the existing Workers subscription. No additional Cloudflare subscription is approved.
- Node 20+ with Express, Go 1.22+ with Echo or `net/http`, and existing OpenTelemetry Collectors using OTLP/HTTP are the supported V0 runtime surfaces.

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
- 2026-07-22 — added an owner-authenticated, bounded recent-failure read path and a trust-focused Data received dashboard that shows retained failures, the exact accepted field contract, aggregate-only boundaries, and data that is never collected; responsive and accessibility review passes completed
- 2026-07-21 — hardened SDK string privacy so official adapters never send unmatched concrete paths and unsafe release strings are omitted; added Go 1.22 ServeMux pattern resolution, optimized UUID generation, and measured approximately 1.7 microseconds serial / 0.04 microseconds 8-way parallel incremental Echo overhead
- 2026-07-22 — added authenticated OTLP/HTTP protobuf and JSON ingestion for existing OpenTelemetry pipelines, strict server-span projection, retry-stable deduplication, sampling provenance, Collector onboarding, and sampled-estimate disclosure
- 2026-07-22 — merged release PR #11 after matching TypeScript and Go CI, deployed Worker version `5b2cbee1-74e9-4eb8-a818-c7a2aa2edd37`, verified both custom domains and OTLP host/auth boundaries, and published Go core `v0.1.5`
- 2026-07-25 — added privacy-safe Hono and Cloudflare Pages Functions adapters,
  Worker runtime reporting, `waitUntil` delivery, Worker onboarding, and a
  verified `0.2.1` JavaScript package ready for immutable GitHub Release
  distribution while npm publisher authentication remains unavailable
- 2026-07-25 — deployed Worker version
  `7f9e8fc5-c8af-4b73-add4-c8b76051cc06`, published the immutable public
  GitHub Release `node-v0.2.1` with the verified npm tarball, and integrated
  that exact asset into Free AI behind an optional ingest-key binding; Free
  AI checks and privacy review pass, while its manual production workflow and
  environment-scoped key remain operator-owned

## Products

- Public GitHub repository and local development checkout.
- Local implemented surfaces: operator web application, Cloudflare-compatible ingest/API service, Node SDK, and Go SDK.

## Features (shipped)

- **Development foundation:** pnpm TypeScript workspace plus Go 1.22 module, versioned runtime-validated endpoint contracts, equivalent Node/Go fixtures, local seeded Worker adapter, and green TypeScript/Go CI.
- **Cloudflare production implementation:** D1 owns apps/environments/hashed keys/install state/bounded dedupe and only normalized endpoint identity plus first/last seen; Workers Analytics Engine owns sampled performance telemetry; a timing-safe owner Worker secret protects owner APIs; the dashboard retains that secret only in page memory; `workers.dev` is disabled; `health.sassmaker.com` and `ingest.sassmaker.com` are live boundaries.
- **Node SDK:** publishable `@saas-maker/app-health` core plus `/express` adapter and bounded fail-open delivery with privacy, outage, retry, overflow, shutdown, package-consumer, and benchmark coverage.
- **Node SDK release:** public `node-v0.2.1` GitHub Release with immutable
  `saas-maker-app-health-0.2.1.tgz` asset and verified SHA-256
  `3039a10809d7eefd3683d4fa2a3aff0c708b29ee52effe4819e11bf0e571890f`.
- **Cloudflare JavaScript adapters:** optional `/hono` middleware and `/pages`
  wrapper preserve application responses, accept lazy no-op configuration,
  record only trusted framework route templates, and keep bounded delivery
  alive with `ExecutionContext.waitUntil`.
- **Go SDK:** real private GitHub module with `net/http` and `/echo` middleware, a bounded adapter record API, route-pattern/resolver support, response/error/panic preservation, privacy/outage/retry/overflow/close tests, and benchmark coverage.
- **Operator dashboard:** local app/key setup, one-time key handoff, verified Express/Echo snippets, installation states, stable endpoint sorting, 15-minute/1-hour/24-hour metrics, responsive table/cards, explicit health thresholds, and reviewed desktop/mobile states.
- **End-to-end local proof:** the Express and Go examples each sent `/health`, `/users/:id`, and `/orders` through the same local ingest and query APIs used by the dashboard; both runtimes reached connected state and the aggregates updated.
- **Storage-bounded ingest:** retry-stable batch IDs reduce temporary D1 dedupe rows by up to 100× at the default batch size; successful requests stay aggregate-only and individual 4xx/5xx details expire after 24 hours.
- **Collection transparency:** an on-demand dashboard view shows the latest 50 retained 4xx/5xx failures, exact accepted telemetry fields, storage/retention boundaries, excluded payload and identity data, contract provenance, and last-refresh evidence without polling or adding storage.
- **Existing OpenTelemetry:** authenticated `/v1/traces` intake accepts bounded OTLP/HTTP protobuf or JSON, projects only trusted HTTP server endpoint summaries, reuses the existing aggregate pipeline, and discloses upstream trace sampling in the API and dashboard.

## Todo / Planned / Deferred / Blocked

1. **Deferred:** the broader owner-first Problem workflow remains outside V0 until endpoint health earns expansion; its superseded planning change is archived rather than presented as active work.
2. **Distribution:** npm publication remains externally gated because the
   configured registry identity returns `E401 Unauthorized`. Version `0.2.1`
   is verified across ESM/CommonJS and all adapter subpaths and uses an
   immutable public GitHub Release asset as the supported fallback; no npm
   release is claimed.
3. **Verification:** the injected-failure D1, owner identity, host-boundary,
   ingest-without-owner-auth, body-limit, no-store, binding-absence, sampled-route,
   and browser non-persistence matrices are covered locally. The live dashboard
   is connected and the production endpoint inventory is accepted.
4. **Free AI pilot:** the exact `0.2.1` release asset and optional Hono
   middleware are committed on `main`; checks and privacy review pass. Its
   repository forbids agent-session deploys, so production deployment remains
   a manual `workflow_dispatch`, and live connection additionally requires an
   environment-scoped `APP_HEALTH_INGEST_KEY`.
