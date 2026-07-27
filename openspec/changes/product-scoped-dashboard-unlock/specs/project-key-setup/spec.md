## MODIFIED Requirements

### Requirement: Owner API fails closed outside local mode
The system SHALL require either the valid global owner bearer secret or an
active product-scoped ingest key outside explicitly marked local development
mode. A product-scoped key SHALL resolve only its stored app and SHALL NOT
authenticate when revoked or when it is a legacy environment-scoped key.

#### Scenario: Non-local identity is missing
- **WHEN** an owner API request runs outside local mode without a valid global owner secret or active product key
- **THEN** the request is rejected and no app, key, or telemetry data is returned or changed

#### Scenario: Active product key unlocks its product
- **WHEN** an owner API request uses an active product-scoped ingest key
- **THEN** the request authenticates with the app scope stored for that key

#### Scenario: Legacy environment key attempts unlock
- **WHEN** an owner API request uses an active legacy environment-scoped ingest key
- **THEN** the request is rejected

#### Scenario: Product key attempts an owner mutation
- **WHEN** a product-scoped session attempts to create an app or revoke a key
- **THEN** the mutation is rejected and stored data remains unchanged
