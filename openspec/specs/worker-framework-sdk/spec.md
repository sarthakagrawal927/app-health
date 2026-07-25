# worker-framework-sdk Specification

## Purpose
TBD - created by archiving change support-worker-frameworks-and-release-sdk. Update Purpose after archive.
## Requirements
### Requirement: Hono middleware records matched routes
The JavaScript SDK SHALL provide optional Hono middleware that records method,
Hono's matched route template, final status code, duration, timestamp, and
optional release through the shared bounded client.

#### Scenario: Hono route handles a request
- **WHEN** a Hono route with template `/users/:id` returns a response
- **THEN** the adapter records `/users/:id` and never reads or sends the concrete parameter value

#### Scenario: Hono route is unmatched
- **WHEN** Hono has no trusted matched route template for a request
- **THEN** the adapter drops the endpoint event without delaying or changing the response

### Requirement: Hono middleware preserves application behavior
The Hono adapter SHALL preserve response status, headers, body, and thrown-error
behavior while recording after downstream handling.

#### Scenario: Hono handler throws
- **WHEN** a downstream Hono handler throws an error
- **THEN** the adapter records a failure when a trusted template exists and rethrows the same error for normal Hono handling

### Requirement: Worker delivery uses the execution lifetime
Worker adapters SHALL register asynchronous flush work with
`ExecutionContext.waitUntil` and SHALL NOT await delivery before returning the
application response.

#### Scenario: Ingest is slow or unavailable
- **WHEN** the App Health ingest request is delayed or fails
- **THEN** the application response remains unchanged and delivery failure is bounded by client retries and diagnostics

### Requirement: Pages Functions use explicit route templates
The JavaScript SDK SHALL provide a Pages Function wrapper that requires a
caller-supplied trusted route template and records the final response or thrown
failure without inspecting the concrete request URL.

#### Scenario: Dynamic Pages Function handles a request
- **WHEN** a function wrapping `/anime/:malId` serves `/anime/42`
- **THEN** telemetry contains `/anime/:malId` and does not contain `42`

### Requirement: Optional Worker configuration is fail-open
Worker adapters SHALL accept a lazy client resolver and SHALL act as a no-op
when it returns `null`, so a missing optional ingest binding cannot make the
application unavailable.

#### Scenario: Deployment has no App Health key
- **WHEN** the consumer's optional ingest-key binding is absent
- **THEN** the original handler response is returned and no telemetry delivery is attempted

### Requirement: Fleet consumer proves immutable installation
At least one Fleet Hono Worker SHALL install the exact public release artifact,
register the middleware in its normal request pipeline, and pass its existing
checks without embedding an ingest credential in source.

#### Scenario: Pilot source is reviewed
- **WHEN** the pilot dependency and middleware integration are inspected
- **THEN** the dependency is pinned to an immutable release URL and the key is read only from optional runtime configuration
