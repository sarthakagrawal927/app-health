## ADDED Requirements

### Requirement: Production Cloudflare bindings
The production Worker SHALL require D1 and Workers Analytics Engine bindings,
serve the built dashboard assets, and fail closed when a required binding or
query configuration is unavailable.

#### Scenario: Production binding is missing
- **WHEN** a production request requires a missing D1, Analytics Engine, or query binding
- **THEN** the Worker returns a bounded service-unavailable response and performs no partial write

### Requirement: Owner routes require verified Access identity
Every non-ingest owner route SHALL validate a Cloudflare Access assertion
against the configured issuer, audience, signature, expiry, and single-owner
allowlist.

#### Scenario: Forged Access assertion reaches an owner route
- **WHEN** an assertion has an invalid signature, issuer, audience, expiry, or owner identity
- **THEN** the Worker rejects the request and returns no owner data

### Requirement: Ingest remains non-interactive and key authenticated
The SDK ingest route SHALL remain reachable without an interactive Access login
and SHALL authenticate only with a valid, scoped, non-revoked ingest key.

#### Scenario: SDK sends telemetry without Access cookies
- **WHEN** the SDK sends a valid bearer ingest key and valid batch without an Access session
- **THEN** the Worker accepts the batch for processing

### Requirement: Workers dev cannot bypass owner protection
The production deployment SHALL disable its public `workers.dev` route or SHALL
apply the same owner JWT validation to every owner request received there.

#### Scenario: Direct Worker hostname is used
- **WHEN** an unauthenticated request reaches an owner API through the direct Worker hostname
- **THEN** the request is rejected without disclosing owner data

### Requirement: Production assets and APIs share one deployable surface
The Worker SHALL route `/v1/*` requests to the API and SHALL serve the built
operator application for supported non-API GET routes.

#### Scenario: Operator opens the configured dashboard hostname
- **WHEN** an authenticated owner requests the dashboard root
- **THEN** the Worker serves the current operator application without a separate application deployment

### Requirement: Production canary proves the primary flow
Release acceptance SHALL prove app creation, one-time key handoff, Node ingest,
Go ingest, installation connection, and endpoint query behavior against the
deployed Cloudflare resources.

#### Scenario: Production candidate is ready for acceptance
- **WHEN** the guarded deployment and Access/routing configuration are complete
- **THEN** the canary reaches connected state and returns endpoint metrics within 30 seconds without persisting prohibited data
