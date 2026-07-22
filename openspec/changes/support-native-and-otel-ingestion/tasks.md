## 1. Canonical ingestion contract

- [ ] 1.1 Add a source-neutral `SafeEndpointObservation` contract containing only opaque event ID, timestamp, method, normalized route, status, duration, optional release, and bounded source metadata.
- [ ] 1.2 Refactor native `EventV1` validation to produce the canonical observation before deduplication, inventory, failure retention, or Analytics Engine writes, without changing current native behavior.
- [ ] 1.3 Expand installation source contracts and owner responses to distinguish `node`, `go`, and `otel` without accepting arbitrary source labels.
- [ ] 1.4 Add canonical fixtures proving equivalent Node, Go, and OpenTelemetry inputs produce equivalent safe observations and query-visible results.
- [ ] 1.5 Add negative contract tests proving unknown native fields and prohibited OpenTelemetry fields cannot enter the canonical observation.

## 2. Native SDK installation experience

- [ ] 2.1 Add the Node minimal initialization API with required key, project, and environment, the production ingest endpoint by default, and optional advanced overrides.
- [ ] 2.2 Keep the prior Node key-and-endpoint configuration source-compatible and add migration tests covering old and new initialization forms.
- [ ] 2.3 Expose Node diagnostics for configured project, environment, queue, delivery, and drop state while redacting the ingest key.
- [ ] 2.4 Update the Express example and Node README to demonstrate one initialization and one middleware registration, plus optional graceful shutdown.
- [ ] 2.5 Add the Go minimal client constructor with required key, project, and environment, the production ingest endpoint by default, and optional functional options.
- [ ] 2.6 Preserve the prior Go client configuration where supported and add migration tests covering existing Echo and `net/http` integrations.
- [ ] 2.7 Expose Go diagnostics for configured project, environment, queue, delivery, and drop state while redacting the ingest key.
- [ ] 2.8 Update the Echo and `net/http` examples and Go README to demonstrate one client construction and one middleware registration, plus optional bounded close.

## 3. OTLP protocol and decoder

- [ ] 3.1 Evaluate a pinned official `opentelemetry-proto` Protobuf runtime, record its license and generated surface, and measure Worker bundle and startup impact before requesting approval for the production dependency.
- [ ] 3.2 Generate or include only the trace, resource, and common OTLP message types required to decode HTTP server spans; exclude metrics, logs, profiles, and collector functionality.
- [ ] 3.3 Implement authenticated `POST /v1/traces` parsing for OTLP binary Protobuf and JSON Protobuf with protocol-correct response content types.
- [ ] 3.4 Support gzip input with separate compressed-body and expanded-body limits and reject malformed or over-limit requests before durable writes.
- [ ] 3.5 Enforce decoded span-count, aggregate-point, processing, and bounded-error-message limits suitable for the existing Cloudflare Worker plan.
- [ ] 3.6 Return protocol-shaped success and partial-success responses, including a bounded rejected-span count, while ensuring malformed, unauthenticated, or request-level over-limit exports write nothing.
- [ ] 3.7 Return bounded unsupported responses for `/v1/metrics`, `/v1/logs`, and other non-trace OTLP surfaces without advertising them as supported integrations.

## 4. Safe OpenTelemetry projection

- [ ] 4.1 Implement an explicit semantic-convention compatibility map for supported stable HTTP server attributes and document the pinned convention version.
- [ ] 4.2 Accept only `SPAN_KIND_SERVER` spans with valid method, normalized `http.route`, response status, start/end timing, and optional `service.version`.
- [ ] 4.3 Reject spans missing a normalized route and prove the mapper never falls back to `url.path`, `url.full`, query data, span name, or network attributes.
- [ ] 4.4 Discard trace context, links, events, baggage, exceptions, stack traces, raw URLs, headers, identity, network data, and every non-allowlisted attribute before canonical projection.
- [ ] 4.5 Derive a deterministic opaque UUID-shaped event ID from key-resolved scope plus trace and span identity using SHA-256, then discard raw trace and span identifiers.
- [ ] 4.6 Add mapper tests for valid modern and approved legacy semantic conventions, unsupported span kinds, malformed timing/status values, mixed exports, and sensitive fields.

## 5. Shared storage and feature parity

- [ ] 5.1 Route accepted native and OpenTelemetry observations through the same bounded deduplication, endpoint inventory, failure retention, and Analytics Engine aggregation pipeline.
- [ ] 5.2 Verify native batch retries and OTLP exporter retries count once within the existing deduplication window without persisting trace identifiers.
- [ ] 5.3 Add source-equivalence integration tests covering endpoint identity, request/error counts, approximate p50/p95 latency, health state, release, installation state, and retained 4xx/5xx failure rows.
- [ ] 5.4 Add persistence assertions proving successful observations remain aggregate-only and OpenTelemetry failures retain no more fields or longer retention than native failures.
- [ ] 5.5 Keep the ingest key authoritative for app and environment scope; add tests proving payload project, environment, service name, or deployment attributes cannot reroute data.

## 6. Cloudflare runtime boundaries

- [ ] 6.1 Expose `/v1/traces` only on the configured ingest hostname and apply the existing dashboard-host and direct-Worker-host rejection boundaries.
- [ ] 6.2 Add Worker tests for bearer ingest-key authentication, owner-key rejection, revoked/invalid key rejection, hostname boundaries, content negotiation, and fail-closed request errors.
- [ ] 6.3 Benchmark representative and maximum bounded OTLP payloads locally and record decode time, memory-sensitive limits, generated Worker bundle size, and startup impact.
- [ ] 6.4 Run `pnpm run deploy:dry-run` and verify the implementation uses only the existing Worker, D1, and Analytics Engine bindings with no new subscription or standing overage authorization.
- [ ] 6.5 Keep native `/v1/ingest` independently releasable and add a route-disable or rollback check proving OTLP can be removed without changing existing clients, keys, or stored data.

## 7. Setup and transparency surfaces

- [ ] 7.1 Replace installation setup with exactly two choices, Native SDK and OpenTelemetry, reusing the same one-time environment-scoped ingest key.
- [ ] 7.2 Show minimal copyable Express, Echo, and `net/http` native snippets containing only key, project, environment, initialization, and middleware registration.
- [ ] 7.3 Show copyable OTLP/HTTP trace endpoint and bearer-header configuration, required HTTP server semantic fields, and an explicit note about upstream sampling.
- [ ] 7.4 Make installation polling report first/last seen and `node`, `go`, or `otel` source without storing or redisplaying the raw key.
- [ ] 7.5 Add an OpenTelemetry transparency ledger showing every used field, canonical destination, retention class, and the categories immediately discarded or unsupported.
- [ ] 7.6 Keep native and OpenTelemetry data in the same endpoint, latency, health, release, and failure views while showing only bounded integration-source labeling.
- [ ] 7.7 Add web tests for the two-choice setup, copyable configurations, source-aware connection state, parity language, and the absence of general traces/logs/metrics claims.

## 8. Documentation and examples

- [ ] 8.1 Document the exact two-path product boundary and state that OpenTelemetry parity means App Health feature parity for eligible exported HTTP server spans, not a general observability backend.
- [ ] 8.2 Add OpenTelemetry configuration examples for direct OTLP/HTTP export and collector fan-out without requiring App Health-specific application middleware.
- [ ] 8.3 Document required semantic conventions, accepted encodings/content types, payload limits, partial-success behavior, retries, key scope, sampling caveats, and unsupported signals.
- [ ] 8.4 Document privacy and storage behavior for both sources, including aggregate-only successes, bounded 4xx/5xx failures, immediate field discard, and lack of trace navigation.
- [ ] 8.5 Update `PROJECT_STATUS.md` and the canonical README so shipped scope, deferred general observability work, dependency choice, and rollout state remain accurate.

## 9. Validation and controlled release

- [ ] 9.1 Run targeted contract, Node SDK, Go SDK, Worker ingest, and web tests while implementing each slice, then run `go test ./...` in the Go SDK and examples where applicable.
- [ ] 9.2 Run the repository-wide `pnpm check`, resolve all regressions, and record any intentionally skipped external verification.
- [ ] 9.3 Exercise local end-to-end native and OTLP fixtures against the Worker and verify equivalent dashboard metrics and failure rows with no prohibited stored fields.
- [ ] 9.4 Prepare a disabled-by-default production route rollout and synthetic native/OTLP canary checklist; do not enable or deploy without the existing manual deploy approval.
- [ ] 9.5 After deployment approval, run the deploy guard, enable the OTLP route, verify both integrations in production, inspect Cloudflare usage against free/existing-plan limits, and retain a tested rollback path.
