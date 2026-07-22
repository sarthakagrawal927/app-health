## Context

App Health starts from an owner workflow rather than an observability data model: install, understand user impact, hand off a fix, and verify recovery. The MVP must accept telemetry from live Express applications without adding request-path failure modes or collecting unsafe payloads. It must also keep deterministic facts separate from generated language, preserve tenant boundaries, and provide a usable local/internal-alpha path before any production infrastructure is created.

The repository is new. The first implementation target is an internal alpha that can run locally against seeded and SDK-generated traffic. Private-beta integrations follow only after the vertical slice proves grouping, owner comprehension, evidence safety, and recovery semantics.

## Goals / Non-Goals

**Goals:**

- Deliver one end-to-end path from an Express request through safe ingestion, grouping, Today/Problem views, fix handoff, and recovery verification.
- Keep public contracts versioned and framework code independent from the Cloudflare implementation.
- Make privacy, tenant isolation, asynchronous delivery, and deterministic explanation facts testable boundaries.
- Split implementation into packages and work items with minimal overlapping file ownership.
- Support local development and seeded incidents without cloud credentials or a production deployment.

**Non-Goals:**

- Public deployment, production resource creation, billing, or automatic customer code changes in this change.
- Generic logs, infrastructure metrics, custom dashboards, frontend replay, full distributed tracing, or framework breadth.
- Exact beta-scale storage architecture. The MVP proves repository contracts so the request-summary store can be replaced after measured load.
- Automatically capturing arbitrary request or response values.

## Decisions

### Use a pnpm TypeScript monorepo with explicit package boundaries

The repository will contain `apps/web`, `apps/worker`, `packages/contracts`, `packages/express`, and `packages/problem-engine`. Shared contracts are runtime-validated at trust boundaries and compile-time typed elsewhere. This keeps the customer SDK, deterministic domain logic, platform adapters, and UI independently testable.

Alternatives considered: a single full-stack application would scaffold faster but would couple the SDK and problem model to one deployment runtime; multiple repositories would add coordination cost before the product contract is stable.

### Build a local-first vertical slice before external integrations

The Worker will expose versioned ingest and authenticated owner APIs, while local fixtures and adapters provide deterministic development data. GitHub-created install PRs, real email delivery, and model generation are later work packages behind interfaces. No test or local flow requires cloud credentials.

Alternatives considered: provisioning Cloudflare first would make a demo appear production-like while slowing review of the product loop and creating irreversible external state.

### Use Cloudflare-native adapters for the MVP, behind repositories

D1 stores accounts, projects, environments, releases, request summaries, problem state, and notification state. R2 stores selectively retained redacted evidence. Queue consumers process accepted event batches outside the ingest request. The application layer depends on repository interfaces so a measured need can move high-volume summaries to ClickHouse without changing the SDK or owner APIs.

Alternatives considered: ClickHouse is better suited to high-volume analytics but adds operational and vendor complexity before traffic is known; D1 alone is not a permanent high-volume observability store, so this choice is intentionally bounded to validation.

### Redact twice and minimize by construction

The Express SDK removes protected headers and values before transit, emits metadata/shape by default, HMACs optional user identifiers with per-write-key material, and caps batches. Ingest validates the schema and repeats redaction before any durable write, queue, evidence object, or model input. Evidence storage accepts only an allowlisted sanitized type rather than arbitrary JSON.

### Separate deterministic problem facts from narrative presentation

`packages/problem-engine` owns normalization, fingerprints, detectors, ranking, confidence inputs, and lifecycle transitions as pure deterministic functions. A structured explanation assembler consumes only computed facts. A provider adapter may rewrite approved fields, but schema validation, prohibited-claim checks, and a deterministic fallback are mandatory.

### Treat environment and tenant scope as server-derived context

Write keys resolve to a project and environment on ingest. Owner APIs resolve membership and active project/environment from authenticated server-side context. Repository methods require that scope explicitly; client-supplied tenant identifiers are never trusted as authorization.

### Prefer event-driven processing with idempotency

Ingest returns after schema validation and queue acceptance. Batch and event IDs make retries idempotent. Consumers persist summaries, select sanitized evidence, update aggregates/problems, and schedule notification state. When pressure rises, healthy evidence detail is discarded before failed or new-fingerprint evidence.

### Keep installation paths progressive

The internal alpha ships a tested manual Express path and a generated coding-agent prompt. GitHub-created PR installation is implemented after the SDK contract stabilizes. All paths converge on the same installation verification checklist: ingest, route normalization, release, environment, and privacy mode.

## Risks / Trade-offs

- **D1 query/storage limits arrive earlier than expected** → keep summary and problem repositories portable, record beta volumes, and define a measured migration trigger before private beta.
- **Route-to-action translation is misleading** → use deterministic fallbacks, optional action labels, confidence, and persistent owner corrections; never invent user counts.
- **Instrumentation harms customer traffic** → no synchronous network calls, bounded in-memory queues, timeouts, fail-open behavior, and focused outage/backpressure/overhead tests.
- **Sensitive values cross the trust boundary** → pre-transit protected-field tests, allowlisted evidence schemas, server-side second-pass redaction, strict size caps, and no raw-value reveal.
- **Generated explanations sound more certain than evidence supports** → facts-first schema, confidence rubric, prohibited causal language, deterministic fallback, and user ratings.
- **Parallel agents create overlapping or inconsistent foundations** → land a reviewed foundation first, then delegate package-owned worktrees with contracts frozen for each wave.
- **MVP scope becomes an observability platform** → each task maps to a P0/P1 requirement and fixed product journey; advanced evidence remains a drill-down.

## Migration Plan

1. Land and verify the repository foundation, package graph, local adapters, CI, and versioned contracts.
2. Land the internal-alpha vertical slice using local D1/R2/Queue emulation and seeded incidents.
3. Add SDK safety, privacy, detector, and tenant-isolation test gates before any live-app pilot.
4. Add private-beta integrations (GitHub installer, email provider, deployment ingestion) behind existing interfaces.
5. Provision and deploy Cloudflare resources only under a separate explicitly approved deploy change.

Rollback before deployment is a git revert of the relevant work package. Future deployed database changes must be additive during beta; destructive migrations require a separate migration plan and explicit approval.

## Open Questions

- Which two hosting platforms dominate the first validation cohort?
- What observed traffic volume should trigger replacing D1 request-summary storage?
- Which outbound HTTP/database libraries earn P1 auto-instrumentation first?
- Which email provider and authentication approach best match the private-beta cohort?
- What minimum event count and observation window balance fast recovery feedback against false resolution?
