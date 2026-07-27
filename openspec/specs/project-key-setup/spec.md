# Project key setup Specification

## Purpose

Define minimal local app creation, product-scoped ingest-key lifecycle, and installation verification.

## Requirements

### Requirement: Minimal app creation
The system SHALL let the authenticated single operator create an app name and initial environment without observability configuration, SHALL durably create the records as one transaction, and SHALL produce one product-scoped ingest key.

#### Scenario: Operator creates an app
- **WHEN** the authenticated operator submits a valid app name and environment
- **THEN** the system durably creates the app and initial environment and shows the new product ingest key exactly once

### Requirement: Safe ingest keys
The system SHALL store only a SHA-256 key verifier in D1, scope each newly issued key to one app, return the raw key only in the no-store creation response, and support revocation. Existing environment-scoped keys SHALL remain valid only for their stored app and environment during migration.

#### Scenario: Revoked key sends telemetry
- **WHEN** ingest receives a batch using a revoked key
- **THEN** it rejects the batch and writes no D1 or Analytics Engine telemetry

### Requirement: Installation verification
The setup view SHALL durably report whether valid SDK endpoint events or eligible OTel server spans have been received for the selected app and environment and SHALL identify the runtime, environment, first seen, and last seen when available.

#### Scenario: First valid SDK batch arrives
- **WHEN** the first Node or Go batch for a new key is accepted
- **THEN** setup changes from waiting for traffic to connected within 30 seconds

#### Scenario: First valid OTLP export arrives
- **WHEN** the first eligible OTel server span for a new key is accepted
- **THEN** setup changes from waiting for traffic to an OpenTelemetry connected state within 30 seconds

### Requirement: Owner API fails closed outside local mode
The system SHALL require a valid dedicated owner bearer secret outside explicitly marked local development mode.

#### Scenario: Non-local identity is missing
- **WHEN** an owner API request runs outside local mode without the valid owner secret
- **THEN** the request is rejected and no app or key is created

### Requirement: Existing apps survive a new browser session
The authenticated operator SHALL be able to list and select existing apps and environments without relying on browser-local persistence.

#### Scenario: Operator returns in a fresh browser session
- **WHEN** the authenticated operator opens the dashboard after prior setup
- **THEN** the durable apps and environments are available for selection without reissuing a key
