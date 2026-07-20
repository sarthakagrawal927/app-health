## Context

V0 is a deliberately narrow endpoint health product. A developer creates an app, receives an ingest key, installs middleware in a Node or Go service, generates traffic, and sees every observed endpoint in one performance table. The implementation must be safe inside customer request paths and useful without logs, traces, payload capture, agents, alerts, or incident semantics.

The repository is new and has no deployed resources. Local development and end-to-end tests must work without credentials. The broader `build-app-health-mvp` artifacts remain a possible roadmap but do not authorize additional V0 scope.

## Goals / Non-Goals

**Goals:**

- Make first telemetry visible within 30 seconds of successful installation and traffic.
- Support Express on Node 20+ and standard `net/http` on Go 1.22+ with small, idiomatic middleware APIs.
- List all endpoints observed since installation and compare 15-minute, 1-hour, and 24-hour performance.
- Add negligible request-path work, batch network delivery asynchronously, and fail open.
- Store aggregates only; never collect headers, query values, parameters, bodies, user identity, logs, stacks, or spans.
- Keep local/test execution credential-free and keep production deployment out of scope.

**Non-Goals:**

- Discovering routes that have never received traffic.
- Supporting every Node or Go web framework in V0.
- Problems/incidents, root-cause analysis, request evidence, tracing, alerts, emails, deployment correlation, AI, user impact, teams/roles, billing, or GitHub installation.
- Production auth, production resource provisioning, deploy, retention administration, or long-term analytics scale.

## Decisions

### Use one repository with TypeScript and Go workspaces

The TypeScript workspace contains `apps/web`, `apps/worker`, `packages/contracts`, and `packages/node`. `packages/go` is an independent Go module. Root commands orchestrate both toolchains without introducing a cross-language build system.

Alternatives considered: separate SDK repositories create version and contract drift before the API stabilizes; a custom monorepo orchestrator adds complexity with no V0 benefit.

### Define one minimal versioned event contract

SDKs send batches of `{event_id, timestamp, method, route, status_code, duration_ms, release?}` plus the schema version. The ingest key resolves project and environment. Route, release, batch size, clock skew, and duration are bounded. Unknown or unsafe fields are rejected rather than stored.

### Instrument framework-native route templates, with documented fallback

The Express adapter records `baseUrl + route.path` after request completion. The Go adapter uses Go 1.22 `Request.Pattern` when available and accepts an optional route-name resolver for third-party routers. Both use a conservative normalization fallback for common numeric and UUID path segments. The dashboard explicitly says “observed endpoints,” because uncalled routes cannot be inferred consistently across runtimes.

### Batch off the response path and fail open

Each SDK records an in-memory summary, returns control to the application, and flushes bounded batches on a timer or size threshold. Delivery uses short timeouts and bounded retries. Queue overflow drops telemetry and increments a local diagnostic counter; it never changes the customer response. Flush hooks support graceful shutdown without making shutdown indefinite.

### Store aggregate buckets, not raw request events

Ingest authenticates and validates each batch, deduplicates event IDs for a bounded window, then updates one-minute buckets keyed by project, environment, method, and route. Buckets store request count, error count, last seen, duration sum, and fixed latency-histogram counts. Query-time merging produces request count, error rate, approximate p50/p95, and last seen for 15-minute, 1-hour, and 24-hour windows.

Alternatives considered: storing raw events enables future debugging but violates V0 minimization and increases cost; averaging percentiles is mathematically wrong, so mergeable fixed histograms are used instead.

### Keep health labels deterministic and secondary to metrics

An endpoint is `insufficient-data` below 20 requests in the selected window. Otherwise it is `unhealthy` at error rate >= 5% or p95 >= 2000 ms, `degraded` at error rate >= 1% or p95 >= 1000 ms, and `healthy` below both degraded thresholds. Thresholds are constants with tests and visible tooltips, not configurable alert rules.

### Use a local identity adapter and fail closed outside local mode

The project/key setup API depends on an owner identity interface. Local development supplies a clearly marked single-operator adapter. Non-local execution without a configured production identity rejects owner API access. Ingest-key authentication remains separate. Production authentication selection and deployment require a later explicit change.

### Use Cloudflare-compatible adapters without provisioning Cloudflare

The Worker implementation targets Cloudflare and an additive D1 schema, with repository interfaces and an in-memory test adapter. The web app is Vite/React. No wrangler deploy, cloud resource creation, credential access, or production configuration is part of V0 implementation.

## Risks / Trade-offs

- **Observed endpoints are mistaken for source inventory** → use “observed” everywhere and show installation time/last traffic.
- **Fallback path normalization merges or splits routes incorrectly** → prefer framework templates, keep fallback conservative, and test numeric/UUID/query cases.
- **SDK harms application latency or reliability** → bound memory/time/retries, never await ingest on the response path, and add outage and benchmark tests.
- **Approximate histogram percentiles surprise users** → document bucket bounds, test merging, and show rounded values rather than false precision.
- **Unauthenticated local setup is deployed accidentally** → non-local owner APIs fail closed without an identity adapter and deployment remains explicitly out of scope.
- **D1 does not fit future volume** → aggregates are behind a repository; measure before selecting a higher-scale store.

## Migration Plan

1. Land repository foundation and shared contract fixtures.
2. Implement and independently test Node SDK, Go SDK, and ingest aggregation against the frozen contract.
3. Implement the endpoint query and dashboard against seeded buckets.
4. Run one Node and one Go example end to end through local ingest and the dashboard.
5. Do not provision or deploy until a later change selects production auth and passes a deploy guard.

Rollback is a git revert because V0 creates no production state. D1 migrations remain additive for future deployment.

## Open Questions

- Which Node framework should follow Express first, if any?
- Which Go router should receive the first route-resolver example?
- Are the initial health thresholds understandable and useful in real traffic?
- What observed volume should trigger a storage review?
