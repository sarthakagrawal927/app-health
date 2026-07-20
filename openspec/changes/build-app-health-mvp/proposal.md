## Why

Non-technical founders and small agencies can see raw application telemetry, but they cannot quickly answer whether users are succeeding, what broke, or what evidence a developer or coding agent needs. App Health will validate an owner-first workflow that turns safe Express request telemetry into ranked user-impacting problems, a bounded fix handoff, and evidence-backed recovery.

## What Changes

- Create a TypeScript monorepo with an Express SDK, a Cloudflare ingestion/API service, asynchronous problem processing, and a Vite/React owner application.
- Provide workspace, project, environment, membership, and write-key foundations with strict tenant and environment isolation.
- Capture normalized request summaries asynchronously, fail open, redact before transit and storage, and retain selective evidence under explicit policies.
- Detect, group, rank, explain, and lifecycle backend problems without overstating user impact or causation.
- Ship the fixed owner workflow: Today, Problems, problem detail, evidence, fix prompt, Deployments, Advanced, and Settings.
- Correlate deployments with problems and verify recovery from later healthy traffic.
- Send deduplicated incident notifications and daily health summaries.
- Instrument the product funnel needed to evaluate activation, usefulness, action rate, recovery, and retention.
- Keep custom dashboards, generic log search, infrastructure monitoring, frontend replay, broad framework support, cost analytics, autonomous code changes, and production deployment outside the MVP.

## Capabilities

### New Capabilities

- `project-access`: Workspace, project, environment, write-key, role, and tenant-isolation behavior.
- `express-telemetry`: Express request-boundary capture, normalization, batching, optional identity/action context, and fail-open guarantees.
- `privacy-ingestion`: Ingestion validation, redaction, selective evidence capture, retention, deletion, and backpressure behavior.
- `problem-intelligence`: Deterministic detection, grouping, impact ranking, explanation facts, confidence, and problem lifecycle.
- `owner-experience`: Owner-facing Today, Problems, Deployments, Advanced, onboarding, and settings workflows.
- `evidence-fix-handoff`: Sanitized technical evidence, deterministic explanations, confidence language, and coding-agent handoffs.
- `deployment-recovery`: Release ingestion, evidence-only correlation, monitoring windows, and verified recovery.
- `notifications-analytics`: Deduplicated incident mail, daily summaries, preferences, and product-success instrumentation.

### Modified Capabilities

- None. This is a new project.

## Impact

- New private GitHub repository and fleet `Support + SaaS` product.
- New public SDK package surface and versioned ingest API contract.
- New Cloudflare Worker, Queue consumers, D1 schema, R2 evidence storage, and Vite application; no production resources are created or deployed by this change.
- New runtime dependencies will be kept minimal and documented by package; dependencies that run on customer request paths require explicit safety justification and focused tests.
- Security-critical surfaces include API-key handling, pre-transit redaction, tenant scoping, retention, and deletion. These are implementation gates, not post-MVP polish.
