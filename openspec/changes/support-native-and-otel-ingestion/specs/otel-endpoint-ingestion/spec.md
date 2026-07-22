## ADDED Requirements

### Requirement: Authenticated OTLP HTTP trace transport
The ingest hostname SHALL accept authenticated OTLP/HTTP trace exports at `POST /v1/traces` using binary Protobuf or JSON Protobuf and SHALL support uncompressed and gzip-encoded requests within configured bounds.

#### Scenario: Valid binary trace export arrives
- **WHEN** a request uses a valid environment-scoped bearer ingest key, supported content type, supported encoding, and bounded body
- **THEN** the Worker parses the export and returns an OTLP-compatible response

#### Scenario: Owner key is used for OTLP ingest
- **WHEN** a request authenticates with the dashboard owner key instead of a valid ingest key
- **THEN** the Worker rejects it and writes no telemetry

### Requirement: Only eligible HTTP server spans are projected
The receiver SHALL project only server-kind spans containing a valid normalized `http.route`, HTTP method, HTTP response status code, start/end timing, and supported semantic-convention values. It SHALL NOT infer a route from a concrete URL, path, query, span name, or network attribute.

#### Scenario: Server span has stable HTTP fields
- **WHEN** a server span contains valid `http.request.method`, `http.route`, `http.response.status_code`, and timing
- **THEN** the receiver creates one canonical safe endpoint observation

#### Scenario: Server span lacks a normalized route
- **WHEN** a span contains `url.path` or `url.full` but no valid `http.route`
- **THEN** the span is rejected from App Health and no concrete path is persisted

#### Scenario: Export contains a client span
- **WHEN** the OTLP request contains a client, producer, consumer, internal, database, or messaging span
- **THEN** the span produces no App Health observation

### Requirement: OpenTelemetry mapping is privacy bounded
Before any durable or analytics write, the receiver SHALL discard trace IDs, span IDs, parent IDs, links, events, baggage, exception content, stack traces, raw URLs, query values, headers, network addresses, identity, and all attributes outside the allowlisted App Health projection.

#### Scenario: Span contains sensitive attributes and exception events
- **WHEN** an otherwise eligible server span includes query data, authorization-like attributes, exception message, and stack trace
- **THEN** accepted storage and query outputs contain none of those values

### Requirement: OTLP retries are idempotent
The receiver SHALL derive a deterministic opaque observation identifier from the key-resolved scope and OpenTelemetry span identity without storing raw trace identifiers, so retrying the same exported span does not increase aggregates twice.

#### Scenario: Exporter retries an accepted span
- **WHEN** the same trace ID and span ID are exported again within the deduplication window
- **THEN** endpoint metrics and retained failures count the span once

### Requirement: Partial success is protocol explicit
For a valid mixed export, the receiver SHALL accept eligible spans and return a bounded OTLP partial-success response containing the rejected span count when other spans are unsupported or unsafe. Malformed, unauthenticated, or over-limit requests SHALL fail without partial writes.

#### Scenario: Export mixes eligible and unsafe spans
- **WHEN** one server span has a normalized route and another has only a concrete path
- **THEN** the eligible span is accepted and the response reports one rejected span

#### Scenario: Expanded gzip body exceeds the limit
- **WHEN** compressed input expands beyond the configured maximum
- **THEN** the entire request is rejected before telemetry writes

### Requirement: App Health is not a general OTLP backend
The production surface SHALL NOT claim or implement arbitrary trace exploration, OTLP metrics, OTLP logs, baggage, profiles, or storage of complete spans as part of this capability.

#### Scenario: Client sends metrics to App Health
- **WHEN** a caller targets an unsupported metrics or logs path
- **THEN** the Worker returns a bounded unsupported response and stores no signal data
