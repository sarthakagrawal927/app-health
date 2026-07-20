# app-health — PROJECT STATUS

Last updated: 2026-07-20

## Why / What

App Health V0 gives a Go or Node application an ingest key and shows how every observed endpoint is performing.

**Users:** A developer or operator who wants immediate endpoint health after installing one small SDK.

**IN scope:** App/environment creation, one ingest key, Express and Go `net/http` middleware, asynchronous endpoint summaries, aggregate-only storage, and a 15-minute/1-hour/24-hour observed-endpoint performance table.

**OUT of scope:** Unobserved source-route discovery, Problems/incidents, raw logs, request or response content, user identity, traces, AI, alerts, deployment recovery, GitHub installation, teams/roles, billing, production auth, and deployment.

## Dependencies

### External

- Cloudflare Worker and D1 are the V0 implementation hypothesis; no production resources exist yet.
- Node 20+ with Express and Go 1.22+ with `net/http` are the supported V0 runtime surfaces.

### Internal

- None.

## Timeline

- 2026-07-20 — project scaffolded
- 2026-07-20 — MVP PRD converted into OpenSpec proposal, capability specs, technical design, and implementation waves
- 2026-07-20 — broad MVP deferred; endpoint-only Go + Node V0 made the active build target
- 2026-07-20 — reviewed V0 workspace, shared contracts, local seeded adapter, and TypeScript/Go CI foundation landed

## Products

- Private GitHub repository and local development checkout.
- Planned surfaces: local operator web application, Cloudflare-compatible ingest/API service, Node SDK, and Go SDK.

## Features (shipped)

- **Development foundation:** pnpm TypeScript workspace plus Go 1.22 module, versioned runtime-validated endpoint contracts, equivalent Node/Go fixtures, local seeded Worker adapter, and green TypeScript/Go CI.

## Todo / Planned / Deferred / Blocked

1. **Planned:** land repository, contracts, local adapter, and CI foundation.
2. **Planned:** implement app/key setup, aggregate ingest, Node SDK, and Go SDK in parallel.
3. **Planned:** implement the observed-endpoint performance dashboard.
4. **Planned:** prove both SDKs end to end and complete privacy, reliability, and dependency review.
5. **Deferred:** the broader owner-first Problem workflow in `build-app-health-mvp` until the endpoint V0 earns expansion.
6. **Blocked for any deployment:** production identity/auth choice and explicit deploy approval.
