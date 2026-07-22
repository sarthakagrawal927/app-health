## MODIFIED Requirements

### Requirement: Node installation API
The Node SDK SHALL expose a minimal constructor requiring only ingest key, project name, and environment, SHALL default the production ingest endpoint, and SHALL require only one Express middleware registration. Endpoint override, release, explicit disable, delivery tuning, and graceful shutdown SHALL remain optional advanced controls.

#### Scenario: Minimal Express installation
- **WHEN** the operator supplies key, project, and environment and mounts the middleware
- **THEN** observed Express requests are asynchronously batched without route registration, Node startup flags, mandatory environment variables, or additional infrastructure

#### Scenario: Existing explicit configuration upgrades
- **WHEN** an application uses the prior key-and-endpoint client configuration
- **THEN** the supported migration release continues to compile and deliver without an immediate breaking rewrite

## ADDED Requirements

### Requirement: Node diagnostics identify configured scope
The Node client SHALL expose local diagnostics containing configured project, environment, queue, delivery, and drop state without exposing the raw ingest key.

#### Scenario: Developer checks installation locally
- **WHEN** the developer reads client diagnostics before traffic is delivered
- **THEN** diagnostics identify project and environment while redacting the key
