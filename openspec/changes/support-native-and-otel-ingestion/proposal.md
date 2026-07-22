## Why

App Health must be trivial to adopt whether a service has no observability stack or already uses OpenTelemetry. Supporting exactly two first-class integration paths prevents adapter sprawl while letting both paths produce the same privacy-bounded endpoint-health product.

## What Changes

- Establish exactly two supported integration paths: the native App Health SDK and OpenTelemetry HTTP server spans.
- Keep native Express, Echo, and Go `net/http` setup to one client initialization plus one middleware registration, with only key, project name, and environment as the operator-facing configuration.
- Add an authenticated OTLP/HTTP trace receiver so an already-instrumented service can integrate by configuring an endpoint and authorization header, without adding App Health middleware.
- Give OpenTelemetry-originated traffic 100% App Health feature parity: observed normalized endpoints, request counts, status/error rates, approximate p50/p95 latency, release attribution, installation state, and retained 4xx/5xx failure rows.
- Map only safe HTTP server-span fields into the existing canonical endpoint event; discard all other span/resource attributes before storage or analytics writes.
- Require a normalized `http.route`; never fall back to concrete URL paths, queries, headers, exception content, trace identifiers, baggage, logs, or identity.
- Keep the existing environment-scoped ingest-key lifecycle, fail-open delivery behavior, batching, aggregation, retention, and dashboard semantics identical across both paths.
- Update setup and transparency surfaces so the operator can choose Native SDK or OpenTelemetry and can see the exact mapping and discarded-data boundary.
- Explicitly exclude general-purpose OpenTelemetry backend behavior: distributed-trace exploration, arbitrary metrics, logs, baggage, profiles, exception messages/stacks, client spans, and collector replacement.

## Capabilities

### New Capabilities

- `dual-integration-experience`: Exactly two minimal setup paths, shared configuration vocabulary, parity expectations, and operator-facing installation guidance.
- `otel-endpoint-ingestion`: Authenticated OTLP/HTTP server-span ingestion, safe semantic-convention mapping, partial-success behavior, and strict signal/privacy boundaries.

### Modified Capabilities

- `node-endpoint-sdk`: Make the native Express integration a minimal key/project/environment initialization plus middleware registration while preserving bounded asynchronous delivery.
- `go-endpoint-sdk`: Make Echo and `net/http` integrations use the same minimal key/project/environment contract and lifecycle.
- `endpoint-ingestion`: Route native and OpenTelemetry inputs through one canonical validation, deduplication, inventory, failure-retention, and aggregate pipeline.
- `project-key-setup`: Issue one environment-scoped ingest key usable by either supported path and present both installation choices without additional observability configuration.
- `cloudflare-production-runtime`: Serve bounded authenticated OTLP/HTTP trace ingestion on the ingest hostname without adding a Cloudflare subscription or exposing owner APIs.
- `data-transparency`: Explain the OpenTelemetry field mapping, immediate discard boundary, supported signal, and parity with native SDK retention.

## Impact

- Affects the Node and Go SDK public installation APIs, examples, package documentation, and compatibility tests.
- Adds an OTLP/HTTP traces route, protobuf/JSON decoding, gzip handling, authentication, bounded request processing, and protocol-compliant success/partial-success responses to the Worker.
- Extends contracts and tests for semantic-convention mapping while retaining the existing canonical App Health event and storage model.
- Updates the setup dashboard, installation verification, Data received view, README, and SDK/collector examples.
- May add optional OpenTelemetry peer dependencies for native span-processor adapters and a narrowly scoped protobuf codec for the Worker; no general collector runtime or new paid service is introduced.
