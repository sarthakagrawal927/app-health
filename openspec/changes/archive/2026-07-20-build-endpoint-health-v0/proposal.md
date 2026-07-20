## Why

The first useful App Health product does not need incident intelligence. It needs to make one promise reliably: install a small SDK in a Go or Node application, give it a project key, and see how every endpoint that receives traffic is performing.

## What Changes

- Create one app/project and issue one environment-scoped ingest key.
- Provide a Node SDK with an Express adapter and a Go SDK compatible with `net/http` handlers.
- Capture only endpoint performance summaries: method, normalized route, status, duration, timestamp, and release when supplied.
- Batch and send telemetry asynchronously without blocking or failing application requests.
- Aggregate observed endpoint traffic into time buckets.
- Show all observed endpoints with request volume, error rate, p50 latency, p95 latency, last seen, and a simple health state over 15-minute, 1-hour, and 24-hour windows.
- Show a clear waiting-for-traffic state and installation verification.
- Explicitly defer Problems, raw logs, traces, request/response bodies, user identity, AI explanations, alerts, deployment recovery, GitHub installation, roles, billing, and production deployment.

## Capabilities

### New Capabilities

- `project-key-setup`: Minimal app/project creation, one-time ingest-key display, revocation, and installation verification.
- `node-endpoint-sdk`: Node request instrumentation through an Express adapter with route normalization and fail-open batching.
- `go-endpoint-sdk`: Go `net/http` middleware with status/duration capture, route naming, and fail-open batching.
- `endpoint-ingestion`: Versioned authentication, validation, idempotent ingest, and endpoint time-bucket aggregation.
- `endpoint-dashboard`: Observed-endpoint listing, time-window performance metrics, health state, sorting, empty state, and freshness.

### Modified Capabilities

- None. The broader `build-app-health-mvp` change is a deferred roadmap, not an implemented baseline.

## Impact

- New TypeScript workspace for the web application, API/ingest service, contracts, and Node SDK.
- New Go module for the Go SDK.
- New versioned ingest and endpoint-query contracts.
- MVP Cloudflare implementation hypothesis: Worker plus D1 aggregate buckets; no resource is provisioned or deployed in this change.
- Runtime dependencies must be minimal because both SDKs run inside customer applications. V0 collects no headers, query values, route parameters, bodies, user identity, logs, stack traces, or spans.
