# app-health — PROJECT STATUS

Last updated: 2026-07-20

## Why / What

App Health tells non-technical founders and agency operators when a live app is hurting users, explains the strongest evidence in owner language, prepares a safe fix handoff, and verifies recovery.

**Users:** Non-technical founders operating live applications; small agencies are the concentrated private-beta segment. Developers and coding agents consume technical evidence but are not the primary UI audience.

**IN scope:** Express request health, safe ingestion, grouped user-impacting Problems, Today and Problem workflows, deployment association, sanitized evidence, coding-agent prompts, verified recovery, email summaries, and privacy/retention controls.

**OUT of scope:** Custom dashboards, generic log search, infrastructure metrics, frontend replay, broad framework support, cost analytics, autonomous code changes, and automatic production deployment.

## Dependencies

### External

- Cloudflare Workers, D1, R2, and Queues for the MVP implementation hypothesis; no production resources exist yet.
- GitHub integration and a transactional email provider are private-beta dependencies and remain unselected.
- Optional narrative generation provider; deterministic explanations remain required when unavailable.

### Internal

- None.

## Timeline

- 2026-07-20 — project scaffolded
- 2026-07-20 — MVP PRD converted into OpenSpec proposal, capability specs, technical design, and implementation waves

## Products

- Private GitHub repository and local development checkout.
- Planned surfaces: owner web application, Cloudflare ingest/API service, and Express SDK package.

## Features (shipped)

- (none yet)

## Todo / Planned / Deferred / Blocked

1. **Planned:** land the reviewed monorepo and local internal-alpha foundation (Wave 0).
2. **Planned:** implement versioned contracts, Express SDK, deterministic problem engine, and safe Worker ingestion (Wave 1).
3. **Planned:** implement owner APIs/UI, explanations, evidence, and fix handoff (Wave 2).
4. **Planned:** implement deployment recovery, notifications, analytics, and GitHub installation (Wave 3).
5. **Planned:** complete security, performance, seeded end-to-end, and customer-validation gates (Wave 4).
6. **Blocked on evidence:** production storage scale trigger, first two hosting targets, email provider, auth provider, and minimum recovery traffic/window.
