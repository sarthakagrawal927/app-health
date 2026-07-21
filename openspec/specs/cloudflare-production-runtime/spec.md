# Cloudflare production runtime Specification

## Purpose

Define the fail-closed Cloudflare deployment, private owner boundary, durable endpoint inventory, and release acceptance contract.

## Requirements

### Requirement: Production Cloudflare bindings
The production Worker SHALL require D1 and Workers Analytics Engine bindings, serve the built dashboard assets, and fail closed when a required binding or query configuration is unavailable.

#### Scenario: Production binding is missing
- **WHEN** a production request requires a missing D1, Analytics Engine, or query binding
- **THEN** the Worker returns a bounded service-unavailable response and performs no partial write

### Requirement: Rare endpoint identities survive metric sampling
The production runtime SHALL durably retain only normalized endpoint identity and first/last seen metadata in D1 so Analytics Engine sampling cannot remove an accepted endpoint from the operator inventory.

#### Scenario: A low-volume route is absent from Analytics Engine query rows
- **WHEN** the Worker queries a window after accepting that normalized route
- **THEN** the endpoint query still returns the route with metrics explicitly marked unavailable

### Requirement: Owner APIs require the dedicated owner secret
Every non-ingest owner API SHALL validate a dedicated high-entropy bearer secret using timing-safe comparison. The dashboard SHALL keep the entered secret only in memory and SHALL NOT place it in browser storage, URLs, logs, or analytics.

#### Scenario: Invalid owner secret reaches an owner API
- **WHEN** the bearer secret is missing or does not match the configured Worker secret
- **THEN** the Worker rejects the request and returns no owner data

### Requirement: Ingest remains non-interactive and key authenticated
The SDK ingest route SHALL remain reachable without an owner dashboard unlock and SHALL authenticate only with a valid, scoped, non-revoked ingest key.

#### Scenario: SDK sends telemetry without an owner session
- **WHEN** the SDK sends a valid bearer ingest key and valid batch without an owner secret
- **THEN** the Worker accepts the batch for processing

### Requirement: Workers dev cannot bypass owner protection
The production deployment SHALL disable its public `workers.dev` route or SHALL apply the same owner-secret validation to every owner API request received there.

#### Scenario: Direct Worker hostname is used
- **WHEN** an unauthenticated request reaches an owner API through the direct Worker hostname
- **THEN** the request is rejected without disclosing owner data

### Requirement: Production assets and APIs share one deployable surface
The Worker SHALL route `/v1/*` requests to the API and SHALL serve the built operator application for supported non-API GET routes.

#### Scenario: Operator opens the configured dashboard hostname
- **WHEN** an operator requests the dashboard root
- **THEN** the Worker serves the current operator application without a separate application deployment

### Requirement: Production canary proves the primary flow
Release acceptance SHALL prove app creation, one-time key handoff, Node ingest, Go ingest, installation connection, and endpoint query behavior against the deployed Cloudflare resources.

#### Scenario: Production candidate is ready for acceptance
- **WHEN** the guarded deployment, owner secret, and routing configuration are complete
- **THEN** the canary reaches connected state and returns endpoint metrics within 30 seconds without persisting prohibited data

### Requirement: Release adds no Cloudflare subscription
The production release SHALL use the account's existing Workers subscription and included D1 and Analytics Engine allowances and SHALL NOT activate Zero Trust or another paid add-on.

#### Scenario: Cloudflare asks for overage authorization for a new product
- **WHEN** provisioning requires accepting a new product subscription or standing overage authorization
- **THEN** release stops without accepting it and uses the owner-secret boundary instead
