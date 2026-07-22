## ADDED Requirements

### Requirement: One key supports either integration path
The one-time environment-scoped ingest key SHALL authenticate both native `/v1/ingest` batches and OpenTelemetry `/v1/traces` exports without issuing a second source-specific key.

#### Scenario: Operator switches installation choice
- **WHEN** the operator changes from Native SDK instructions to OpenTelemetry instructions before sending traffic
- **THEN** setup reuses the same one-time key and durable app/environment scope

### Requirement: Setup presents two installation choices
The setup view SHALL present Native SDK and OpenTelemetry as the only installation choices and SHALL provide a copyable minimal configuration for each without persisting the raw key.

#### Scenario: Operator chooses Native SDK
- **WHEN** the selected language/framework is Express, Echo, or Go `net/http`
- **THEN** setup shows one initialization and one middleware registration using key, project, and environment

#### Scenario: Operator chooses OpenTelemetry
- **WHEN** the service already emits HTTP server spans
- **THEN** setup shows the trace endpoint and authorization configuration plus the required safe semantic fields

### Requirement: Installation verification is source aware
Installation verification SHALL report whether the first accepted observation came from Node, Go, or OpenTelemetry while preserving first seen, last seen, app, and environment scope.

#### Scenario: First OpenTelemetry span arrives
- **WHEN** the first eligible span is accepted for the selected key
- **THEN** setup changes from waiting to connected and identifies OpenTelemetry as the source
