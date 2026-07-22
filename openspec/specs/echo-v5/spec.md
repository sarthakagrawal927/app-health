# Echo v5 Specification

## Purpose

Define explicit, privacy-preserving Echo v5 installation and endpoint capture.

## Requirements

### Requirement: Environment-gated construction
The core SDK SHALL provide a small environment constructor that returns a project-aware client only when App Health is explicitly enabled, the required environment matches, and the ingest key exists.

#### Scenario: Explicit enable flag is absent
- **WHEN** `APP_HEALTH_ENABLED` is not exactly `true`
- **THEN** the constructor returns nil without starting a delivery goroutine

#### Scenario: Non-target environment has a key
- **WHEN** `APP_ENV` does not equal the required environment
- **THEN** the constructor returns nil without starting a delivery goroutine

#### Scenario: Project-aware client is enabled
- **WHEN** all gates pass for project `polaris` and environment `staging`
- **THEN** the client retains that expected identity while the ingest key remains authoritative for server-side attribution

### Requirement: Echo v5 endpoint capture
The SDK SHALL provide Echo v5 middleware that records only the matched route template, method, final status, duration, timestamp, and configured release through the shared bounded client.

#### Scenario: Parameterized route receives traffic
- **WHEN** `/accounts/:id` receives different concrete IDs
- **THEN** the event route is `/accounts/:id` and contains neither ID

#### Scenario: Handler returns an HTTP error
- **WHEN** a handler returns an `echo.HTTPError`
- **THEN** the adapter records its status and returns the same error

#### Scenario: No route matches
- **WHEN** Echo has no matched route
- **THEN** no event containing the concrete path is sent

#### Scenario: Ingest is unavailable
- **WHEN** delivery fails
- **THEN** the application response and returned error remain unchanged
