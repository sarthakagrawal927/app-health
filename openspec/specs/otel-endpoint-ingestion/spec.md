# OpenTelemetry endpoint ingestion Specification

## Purpose

Define authenticated, privacy-bounded OTLP/HTTP projection into endpoint health.

## Requirements

### Requirement: Authenticated OTLP HTTP trace intake
The ingest host SHALL accept bounded OTLP/HTTP trace export requests at `/v1/traces` only when a product-scoped or legacy environment-scoped bearer key is valid, SHALL support binary protobuf and OTLP JSON request encodings, and SHALL resolve product-key environments only from the standard `deployment.environment.name` resource attribute.

#### Scenario: Existing Collector exports traces
- **WHEN** a standard OTLP/HTTP exporter sends a valid authenticated trace request
- **THEN** App Health returns a protocol-valid success response and scopes all accepted endpoint data to the authenticated app and resolved environment

#### Scenario: OTLP key is invalid
- **WHEN** an OTLP export uses a missing, invalid, or revoked bearer key
- **THEN** ingest rejects it before projecting or persisting any endpoint data

#### Scenario: Product-key OTLP environment is absent
- **WHEN** a product-key OTLP resource does not declare a valid `deployment.environment.name`
- **THEN** ingest rejects its eligible spans without writing telemetry

#### Scenario: One export carries multiple environments
- **WHEN** one valid product-key export contains eligible resources for `local` and `staging`
- **THEN** ingest groups and persists each resource's endpoint summaries only within its resolved environment

### Requirement: Privacy-bounded server span projection
OTLP ingest SHALL read only `deployment.environment.name` for routing and SHALL project only HTTP server spans with a trusted normalized `http.route` into method, route, status, duration, timestamp, optional release, and deterministic event identity. It SHALL NOT persist or forward the routing label or any other resource, span, attribute, event, link, baggage, URL, header, body, identity, log, stack, or trace data.

#### Scenario: Server span contains sensitive attributes
- **WHEN** an eligible server span also contains a concrete URL, query, user identifier, headers, exception event, and arbitrary attributes
- **THEN** only the approved endpoint summary fields reach inventory and aggregate storage

#### Scenario: Server span has no trusted route
- **WHEN** a span contains a concrete URL path but no string `http.route`
- **THEN** App Health drops the span rather than deriving or transmitting a concrete route

### Requirement: HTTP semantic convention compatibility
OTLP projection SHALL accept stable HTTP method and status attributes and the prior widely deployed aliases, with stable names taking precedence when both are present.

#### Scenario: Collector emits legacy HTTP attributes
- **WHEN** a server span uses `http.method` and `http.status_code` with a trusted `http.route`
- **THEN** App Health produces the same endpoint identity and performance contribution as the equivalent stable attributes

### Requirement: Idempotent bounded OTLP processing
OTLP ingest SHALL enforce compressed and decompressed body limits, cap work per request, derive retry-stable event identifiers from trace and span identity, and use the existing bounded deduplication path.

#### Scenario: Collector retries an export
- **WHEN** the same eligible span is exported twice within the deduplication window
- **THEN** endpoint inventory and aggregate counts increase only once

#### Scenario: OTLP body exceeds its bound
- **WHEN** a compressed or decompressed export exceeds the configured request limit
- **THEN** the Worker rejects the request without decoding or storing telemetry

### Requirement: Conservative trace sampling provenance
Every endpoint aggregate derived from OTLP traces SHALL be marked as upstream-sampled because the export payload cannot prove source-stream completeness.

#### Scenario: OTel endpoint metrics are queried
- **WHEN** an endpoint window contains one or more trace-derived contributions
- **THEN** the API marks that endpoint as upstream sampled even if every received span has the sampled trace flag
