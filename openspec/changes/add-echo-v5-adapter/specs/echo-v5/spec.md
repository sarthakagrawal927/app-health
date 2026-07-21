## ADDED Requirements

### Requirement: Echo v5 endpoint capture
The SDK SHALL provide Echo v5 middleware that records only the matched route
template, method, final status, duration, timestamp, and configured release
through the shared bounded client.

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
