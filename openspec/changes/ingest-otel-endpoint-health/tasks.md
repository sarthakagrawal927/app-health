## 1. Contracts and aggregate provenance

- [x] 1.1 Add the `otel` installation runtime and optional upstream-sampling provenance to endpoint event, bucket, query, and repository contracts
- [x] 1.2 Propagate OTel sampling provenance through in-memory aggregation and an additive Analytics Engine blob/query field without a D1 migration

## 2. OTLP trace ingestion

- [x] 2.1 Add a bounded OTLP/HTTP binary-protobuf and JSON decoder that projects only eligible HTTP server spans and supports current plus legacy semantic attributes
- [x] 2.2 Add deterministic retry-stable event IDs, strict route/release validation, bounded gzip decoding, and per-request span limits
- [x] 2.3 Add the ingest-host-only authenticated `/v1/traces` route and feed projected spans through existing deduplication, inventory, aggregate, and installation-state paths

## 3. OpenTelemetry setup experience

- [x] 3.1 Add an Existing OpenTelemetry setup tab with a copy-ready standard Collector exporter/pipeline snippet and one-time-key protection
- [x] 3.2 Add connected-runtime and desktop/mobile endpoint disclosure for trace-derived sampled estimates
- [x] 3.3 Update README documentation with the OTel path, supported semantics, privacy projection, sampling limitation, and local verification instructions

## 4. Verification

- [x] 4.1 Add focused Worker tests for authentication, host/method/content type, protobuf and JSON projection, gzip/body bounds, privacy omission, semantic aliases, malformed input, span caps, deduplication, and installation state
- [x] 4.2 Add contract, Analytics Engine, and dashboard tests for OTel runtime, provenance propagation, setup switching, copy-ready configuration, and sampling disclosure
- [x] 4.3 Run formatting, lint, typecheck, focused and full tests, builds, dependency review, and strict OpenSpec validation
