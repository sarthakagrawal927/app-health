## MODIFIED Requirements

### Requirement: Installation verification
The setup view SHALL durably report whether valid SDK endpoint events or
eligible OTel server spans have been received for the selected app and
environment and SHALL identify the runtime, environment, first seen, and last
seen when available.

#### Scenario: First valid SDK batch arrives
- **WHEN** the first Node or Go batch for a new key is accepted
- **THEN** setup changes from waiting for traffic to connected within 30 seconds

#### Scenario: First valid OTLP export arrives
- **WHEN** the first eligible OTel server span for a new key is accepted
- **THEN** setup changes from waiting for traffic to an OpenTelemetry connected state within 30 seconds
