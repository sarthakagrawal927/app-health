## ADDED Requirements

### Requirement: Minimal app creation
The system SHALL let the local V0 operator create an app name and environment without observability configuration and SHALL produce one ingest key.

#### Scenario: Operator creates an app
- **WHEN** the operator submits a valid app name and environment
- **THEN** the system creates the scoped app and shows the new ingest key exactly once

### Requirement: Safe ingest keys
The system SHALL store only a non-reversible key verifier, scope a key to one app and environment, and support revocation.

#### Scenario: Revoked key sends telemetry
- **WHEN** ingest receives a batch using a revoked key
- **THEN** it rejects the batch and updates no aggregate

### Requirement: Installation verification
The setup view SHALL report whether a valid event has been received for the key and SHALL identify the runtime, environment, first seen, and last seen when available.

#### Scenario: First valid batch arrives
- **WHEN** the first Node or Go batch for a new key is accepted
- **THEN** setup changes from waiting for traffic to connected within 30 seconds

### Requirement: Owner API fails closed outside local mode
The system SHALL require a configured owner identity outside explicitly marked local development mode.

#### Scenario: Non-local identity is missing
- **WHEN** an owner API request runs outside local mode without an identity adapter
- **THEN** the request is rejected and no app or key is created
