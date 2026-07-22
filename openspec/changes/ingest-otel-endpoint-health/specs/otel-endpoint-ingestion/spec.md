## ADDED Requirements

### Requirement: Authenticated OTLP HTTP trace intake
The ingest host SHALL accept bounded OTLP/HTTP trace export requests at
`/v1/traces` only when the existing environment-scoped bearer key is valid,
and SHALL support binary protobuf and OTLP JSON request encodings.

#### Scenario: Existing Collector exports traces
- **WHEN** a standard OTLP/HTTP exporter sends a valid authenticated trace request
- **THEN** App Health returns a protocol-valid success response and scopes all accepted endpoint data to the key's app and environment

#### Scenario: OTLP key is invalid
- **WHEN** an OTLP export uses a missing, invalid, or revoked bearer key
- **THEN** ingest rejects it before projecting or persisting any endpoint data

### Requirement: Privacy-bounded server span projection
OTLP ingest SHALL project only HTTP server spans with a trusted normalized
`http.route` into method, route, status, duration, timestamp, optional release,
and deterministic event identity, and SHALL NOT persist or forward any other
resource, span, attribute, event, link, baggage, URL, header, body, identity,
log, stack, or trace data.

#### Scenario: Server span contains sensitive attributes
- **WHEN** an eligible server span also contains a concrete URL, query, user identifier, headers, exception event, and arbitrary attributes
- **THEN** only the approved endpoint summary fields reach inventory and aggregate storage

#### Scenario: Server span has no trusted route
- **WHEN** a span contains a concrete URL path but no string `http.route`
- **THEN** App Health drops the span rather than deriving or transmitting a concrete route

### Requirement: HTTP semantic convention compatibility
OTLP projection SHALL accept stable HTTP method and status attributes and the
prior widely deployed aliases, with stable names taking precedence when both
are present.

#### Scenario: Collector emits legacy HTTP attributes
- **WHEN** a server span uses `http.method` and `http.status_code` with a trusted `http.route`
- **THEN** App Health produces the same endpoint identity and performance contribution as the equivalent stable attributes

### Requirement: Idempotent bounded OTLP processing
OTLP ingest SHALL enforce compressed and decompressed body limits, cap work per
request, derive retry-stable event identifiers from trace and span identity,
and use the existing bounded deduplication path.

#### Scenario: Collector retries an export
- **WHEN** the same eligible span is exported twice within the deduplication window
- **THEN** endpoint inventory and aggregate counts increase only once

#### Scenario: OTLP body exceeds its bound
- **WHEN** a compressed or decompressed export exceeds the configured request limit
- **THEN** the Worker rejects the request without decoding or storing telemetry

### Requirement: Conservative trace sampling provenance
Every endpoint aggregate derived from OTLP traces SHALL be marked as
upstream-sampled because the export payload cannot prove source-stream
completeness.

#### Scenario: OTel endpoint metrics are queried
- **WHEN** an endpoint window contains one or more trace-derived contributions
- **THEN** the API marks that endpoint as upstream sampled even if every received span has the sampled trace flag
