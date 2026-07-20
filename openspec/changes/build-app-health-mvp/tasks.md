> **Deferred roadmap:** Do not apply these tasks during V0. The active implementation checklist is `../build-endpoint-health-v0/tasks.md`.

## 1. Foundation — reviewed baseline (Wave 0, one agent)

- [ ] 1.1 Create the pnpm workspace, root scripts, shared TypeScript and lint configuration, package graph, and checked-in lockfile without adding unused runtime dependencies.
- [ ] 1.2 Scaffold `apps/web`, `apps/worker`, `packages/contracts`, `packages/express`, and `packages/problem-engine` with package-local check and test commands.
- [ ] 1.3 Add a local-first development path with seeded healthy and failing traffic that requires no cloud credentials.
- [ ] 1.4 Replace the skeleton CI with install, formatting/lint, typecheck, unit-test, and build jobs using the repository package manager.
- [ ] 1.5 Document architecture, local commands, dependency rationale, validation cohort, and the no-deploy boundary in README and project instructions.

## 2. Versioned contracts and fixtures (Wave 1A, contracts owner)

- [ ] 2.1 Define runtime-validated v1 request batch, request summary, sanitized evidence, release, Problem, explanation, and owner API contracts.
- [ ] 2.2 Add canonical fixtures for healthy requests, application exceptions, dependency timeouts, rate limits, latency regressions, deployments, and recovery traffic.
- [ ] 2.3 Add contract tests for unknown fields, schema version compatibility, size limits, prohibited fields, and deterministic serialization.
- [ ] 2.4 Document public compatibility rules and how new readers handle older event and redaction-policy versions.

## 3. Express SDK boundary (Wave 1A, SDK owner)

- [ ] 3.1 Implement minimal Express middleware that captures method, route template, status, duration, sizes, request ID, release, region, and thrown-error metadata.
- [ ] 3.2 Implement dynamic route normalization and stable error fingerprints without collecting arbitrary URL or body values.
- [ ] 3.3 Implement explicit action labels and pre-transit keyed hashing for optional user identifiers; omit user identity when unavailable.
- [ ] 3.4 Implement bounded asynchronous batching, retry limits, shutdown flush, backpressure, and fail-open behavior.
- [ ] 3.5 Add protected-field, unavailable-ingest, rate-limit, queue-pressure, route-normalization, error-capture, and no-identity tests.
- [ ] 3.6 Add the representative overhead benchmark and enforce/report the p95 boundary-only target.

## 4. Deterministic problem engine (Wave 1B, domain owner)

- [ ] 4.1 Implement pure normalization and fingerprint functions that keep dependency timeouts distinct from application exceptions.
- [ ] 4.2 Implement versioned detectors for new errors, failure spikes, dependency failures, timeouts, rate limits, and latency regressions with inspectable triggers.
- [ ] 4.3 Implement impact-first ranking using known unique impact or failed actions, criticality, recency, confidence, and persistence.
- [ ] 4.4 Implement Active, Monitoring, Resolved, and Ignored transitions with explicit observation and meaningful-traffic thresholds.
- [ ] 4.5 Implement persistent correction operations for rename, split, merge, ignore, and critical-action weighting.
- [ ] 4.6 Add deterministic tests for the PRD examples, low-volume critical ranking, insufficient recovery traffic, recurrence, and false-positive suppression.

## 5. Access, ingest, and storage adapters (Wave 1C, Worker owner)

- [ ] 5.1 Add additive D1 migrations and repository interfaces for workspaces, memberships, projects, environments, write keys, summaries, evidence metadata, releases, Problems, corrections, notifications, and audit entries.
- [ ] 5.2 Implement one-time write-key display, non-reversible verification, environment scoping, revocation, and test helpers.
- [ ] 5.3 Implement v1 batch ingest with authentication, idempotency, size/schema validation, second-pass redaction, and queue acceptance.
- [ ] 5.4 Implement Queue processing that stores summaries, selects only allowlisted evidence for R2, invokes the problem engine, and preserves failure evidence under pressure.
- [ ] 5.5 Implement configurable retention and project deletion orchestration with auditable progress and local adapter tests.
- [ ] 5.6 Add tenant, project, environment, cross-object, malformed-batch, revoked-key, redaction, retention, idempotency, and pressure tests.

## 6. Owner API and local authentication boundary (Wave 2A, API owner)

- [ ] 6.1 Implement an authentication adapter and local development identity without production credentials; derive authorization scope on the server.
- [ ] 6.2 Implement workspace/project/environment setup and Owner/Admin/Viewer authorization endpoints.
- [ ] 6.3 Implement Today, Problems list/detail, sanitized evidence, Deployments, Advanced summaries, Settings, and installation-status query endpoints.
- [ ] 6.4 Implement authorized rename, split, merge, ignore, critical-action, retention, member, key, and deletion mutations.
- [ ] 6.5 Add API tests proving default environment separation, role restrictions, cross-tenant denial, and protected evidence projection.

## 7. Owner application vertical slice (Wave 2B, web owner)

- [ ] 7.1 Create the accessible responsive application shell with Today, Problems, Deployments, Advanced, and Settings navigation and project/environment selection.
- [ ] 7.2 Implement onboarding for project creation, coding-agent prompt, manual Express setup, test-event verification, and up to three critical action labels.
- [ ] 7.3 Implement the calm Today state with three to five owner facts, impact-ranked Problems, deployment context, and healthy empty state.
- [ ] 7.4 Implement grouped Problems and Problem detail leading with impact, cause hypothesis, confidence, evidence, next action, fix handoff, and recovery status.
- [ ] 7.5 Implement Deployments and Advanced endpoint/failure/stack/span drill-downs without promoting technical metrics into the primary workflow.
- [ ] 7.6 Implement Settings for installation, environments, privacy/capture rules, retention, members, notification preferences, and deletion.
- [ ] 7.7 Add component/route tests plus desktop and mobile browser evidence for onboarding, healthy Today, active Problem, and protected Settings actions.

## 8. Explanations and fix handoff (Wave 2C, evidence owner)

- [ ] 8.1 Implement the deterministic structured explanation assembler from computed Problem facts and the High/Medium/Low confidence rubric.
- [ ] 8.2 Add an optional narrative provider interface with schema validation, prohibited-claim checks, minimum-necessary inputs, and deterministic fallback.
- [ ] 8.3 Implement allowlisted evidence projection and current-policy re-redaction before owner API or model use.
- [ ] 8.4 Implement coding-agent prompt generation and copy tracking with symptom, sanitized samples, release association, confidence, and verification steps.
- [ ] 8.5 Implement Accurate, Useful but incomplete, and Wrong feedback as evaluation data with correction/ignore paths.
- [ ] 8.6 Add adversarial tests for invented users, provider names, code locations, causal release claims, secret-like values, and provider failure.

## 9. Deployment correlation and verified recovery (Wave 3A)

- [ ] 9.1 Detect idempotent release markers from SDK traffic and accept explicit release events through the versioned contract.
- [ ] 9.2 Compute before/after rates, time relationships, changed fingerprints when known, and inspectable evidence strength.
- [ ] 9.3 Implement Active-to-Monitoring transitions after a later change plus follow-up traffic, and Monitoring-to-Resolved transitions after observation and volume thresholds.
- [ ] 9.4 Implement Monitoring-to-Active recurrence while preserving recovery-attempt history.
- [ ] 9.5 Add release-correlation language, insufficient-traffic, verified-recovery, recurrence, and multi-environment tests.

## 10. Notifications and product analytics (Wave 3B)

- [ ] 10.1 Implement a provider-neutral mail interface and local outbox adapter; do not add or configure a production mail provider in this change.
- [ ] 10.2 Implement one incident thread per Problem with usefulness thresholds, duplicate suppression, material-status updates, and scoped unsubscribe tokens.
- [ ] 10.3 Implement scheduled daily owner summaries with healthy and top-Problem variants.
- [ ] 10.4 Implement the PRD product events for activation, views, evidence, ratings, handoff, release, recovery, ignore, and unsubscribe without customer payload content.
- [ ] 10.5 Add notification dedupe, preference authorization, unsubscribe isolation, daily-summary, and payload-minimization tests.

## 11. GitHub installation path (Wave 3C, private-beta gate)

- [ ] 11.1 Implement repository/framework detection behind a least-privilege GitHub adapter and produce a reviewable installation plan.
- [ ] 11.2 Implement coding-agent prompt generation from the same installation plan and keep manual middleware as the escape hatch.
- [ ] 11.3 Implement GitHub-created installation changes only after explicit user confirmation, with SDK setup, release metadata, secret-name instructions, and no secret values.
- [ ] 11.4 Verify all installation paths converge on test-event, route, environment, release, and privacy-mode checks.
- [ ] 11.5 Add fixture-repository tests for supported Express layouts and safe failure on ambiguous or unsupported layouts.

## 12. Security, performance, and internal-alpha proof (Wave 4)

- [ ] 12.1 Run dependency, tenant-isolation, protected-field, deletion, model-input, and cross-object security review gates and fix all high-severity findings.
- [ ] 12.2 Prove SDK fail-open behavior under outage, throttling, and pressure and record the p95 overhead benchmark.
- [ ] 12.3 Prove request freshness, incident-update freshness, and common owner-view performance against documented internal-alpha data volume.
- [ ] 12.4 Run the end-to-end seeded journey: install verification, live traffic, grouped Problem, sanitized evidence, fix prompt, later release, Monitoring, and Resolved.
- [ ] 12.5 Validate owner language with the PRD questions and record concierge cohort recruitment, hosting-platform, traffic-threshold, and willingness-to-pay unknowns as blockers rather than invented conclusions.
- [ ] 12.6 Update `PROJECT_STATUS.md`, close or defer every remaining task explicitly, and archive the OpenSpec change only when required checks pass and the implemented MVP boundary is accurate.
