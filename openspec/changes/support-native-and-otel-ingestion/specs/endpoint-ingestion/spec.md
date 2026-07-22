## MODIFIED Requirements

### Requirement: Versioned authenticated batches
Ingest SHALL authenticate the environment-scoped key against its D1 SHA-256 verifier, enforce bounded request bodies before parsing, validate each supported source contract, reject unknown unsafe native content, and project valid native Node, native Go, and OpenTelemetry HTTP server observations into one canonical safe event shape.

#### Scenario: Valid equivalent source fixtures
- **WHEN** canonical Node, Go, and OpenTelemetry fixtures carry equivalent endpoint observations
- **THEN** ingest validates all three into equivalent canonical safe events

### Requirement: Idempotent event processing
Ingest SHALL deduplicate native batch retries and OpenTelemetry span retries in D1 for a bounded window so retrying either supported source does not increase Analytics Engine metrics or retained failures twice.

#### Scenario: Native SDK retries a batch
- **WHEN** the same valid native batch is accepted twice within the deduplication window
- **THEN** Analytics Engine and failure counts increase only once

#### Scenario: OpenTelemetry exporter retries spans
- **WHEN** the same eligible spans are accepted twice within the deduplication window
- **THEN** Analytics Engine and failure counts increase only once without storing trace identifiers

## ADDED Requirements

### Requirement: Source-neutral storage and querying
After canonical projection, inventory, failure retention, aggregation, percentile calculation, health classification, and dashboard queries SHALL behave identically for native and OpenTelemetry observations. Only bounded source metadata MAY differ.

#### Scenario: Equivalent source observations are queried
- **WHEN** separate environments receive equivalent native and OpenTelemetry traffic
- **THEN** endpoint metrics, health state, and retained failure fields are equivalent

### Requirement: Integration source is bounded metadata
Installation state SHALL distinguish `node`, `go`, and `otel` sources without persisting arbitrary telemetry SDK attributes or changing key-resolved app/environment scope.

#### Scenario: First OTLP export is accepted
- **WHEN** eligible OpenTelemetry server spans arrive for a waiting environment
- **THEN** installation state becomes connected with source `otel`
