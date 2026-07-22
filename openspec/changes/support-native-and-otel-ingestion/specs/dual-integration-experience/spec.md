## ADDED Requirements

### Requirement: Exactly two supported integration paths
App Health SHALL present and support exactly two first-class service integration paths: Native SDK and OpenTelemetry. The product SHALL NOT add another customer-facing ingestion path without a separate approved specification.

#### Scenario: Operator starts installation
- **WHEN** an operator creates or selects an app environment
- **THEN** setup offers Native SDK and OpenTelemetry as the only integration choices

### Requirement: Native integration remains minimal
The Native SDK path SHALL require only the environment-scoped key, project name, and environment as operator-facing values, one client initialization, and one framework middleware registration. The production ingest endpoint SHALL have a safe default.

#### Scenario: Express service installs App Health
- **WHEN** a developer supplies key, project, and environment and mounts the Express middleware
- **THEN** request summaries begin batching without route registration, startup flags, or additional infrastructure

### Requirement: OpenTelemetry integration is configuration-only
An application that already emits OpenTelemetry HTTP server spans SHALL integrate by configuring the App Health OTLP/HTTP traces endpoint and bearer ingest key, without mounting App Health middleware.

#### Scenario: Existing OpenTelemetry service configures App Health
- **WHEN** its trace exporter points to the documented App Health endpoint with a valid authorization header
- **THEN** eligible HTTP server spans produce App Health endpoint observations without application-code instrumentation changes

### Requirement: Integration paths have App Health feature parity
Eligible requests from either integration path SHALL produce the same observed endpoint identity, request and error aggregates, approximate p50/p95 latency, health state, installation state, release attribution, and bounded 4xx/5xx failure rows.

#### Scenario: Equivalent native event and server span arrive
- **WHEN** both describe the same method, normalized route, status, duration, timestamp, and release in separate test environments
- **THEN** their App Health query and failure results are equivalent apart from source metadata and opaque identifiers

### Requirement: Setup never implies general OpenTelemetry storage
The setup and documentation SHALL state that App Health derives endpoint health from eligible HTTP server spans and SHALL NOT claim support for general traces, metrics, logs, baggage, profiles, or collector replacement.

#### Scenario: Operator reviews OpenTelemetry installation
- **WHEN** setup displays the OTLP configuration
- **THEN** it also displays the supported server-span fields and immediate discard boundary
