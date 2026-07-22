## ADDED Requirements

### Requirement: Minimal Go installation API
The Go SDK SHALL expose one client constructor requiring only ingest key, project name, and environment, SHALL default the production ingest endpoint, and SHALL support one middleware registration for Echo or Go `net/http`. Endpoint override, release, explicit disable, delivery tuning, and bounded close SHALL remain optional advanced controls.

#### Scenario: Minimal Echo installation
- **WHEN** the operator constructs one client with key, project, and environment and mounts the Echo middleware
- **THEN** observed Echo requests are asynchronously batched without route registration, process-wide environment mutation, or additional infrastructure

#### Scenario: Minimal net/http installation
- **WHEN** the same client wraps a Go `net/http` handler
- **THEN** the handler behavior is preserved and normalized observations use the same configured scope

### Requirement: Go diagnostics identify configured scope
The Go client SHALL expose local diagnostics containing configured project, environment, queue, delivery, and drop state without exposing the raw ingest key.

#### Scenario: Developer checks installation locally
- **WHEN** the developer reads client statistics before shutdown
- **THEN** diagnostics identify project and environment while redacting the key
