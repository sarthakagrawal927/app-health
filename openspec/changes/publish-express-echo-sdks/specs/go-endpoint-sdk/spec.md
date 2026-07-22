## ADDED Requirements

### Requirement: Echo request performance capture
The Go SDK SHALL provide Echo v5 middleware that records method, Echo's
normalized matched route template, final status code, duration, timestamp, and
optional release while preserving Echo handler behavior.

#### Scenario: Echo parameterized route receives traffic
- **WHEN** Echo handles requests for `/users/:id` with different concrete IDs
- **THEN** the SDK emits one normalized `GET /users/:id` endpoint identity

#### Scenario: Echo handler returns an HTTP error
- **WHEN** an Echo handler returns an `echo.HTTPError` before committing a response
- **THEN** the adapter records the error status and returns the same error for Echo's normal error handling

### Requirement: Framework adapters use bounded public recording
The Go core SHALL expose a concurrency-safe non-blocking record operation that
applies the same validation, queue bound, privacy rules, and diagnostics as its
standard `net/http` middleware.

#### Scenario: Echo adapter records while ingest is unavailable
- **WHEN** Echo requests complete while delivery fails
- **THEN** responses and returned errors remain unchanged and telemetry loss is bounded in diagnostics

### Requirement: Echo installation exposes only application-owned inputs
The Echo adapter SHALL expose one installation config with `Enabled`,
`Environment`, `Key`, and `Project`. It SHALL NOT require consumers to configure
the ingest URL, queue, batch, timeout, retry, redaction, or shutdown mechanics.

#### Scenario: Staging service enables App Health
- **WHEN** a service installs the adapter with enablement true and a valid key
- **THEN** the SDK records requests asynchronously using its production-safe defaults

#### Scenario: Service disables App Health
- **WHEN** enablement is false or the key is empty
- **THEN** installation is a no-op and application startup and requests are unchanged

## MODIFIED Requirements

### Requirement: Third-party router naming escape hatch
The Go SDK SHALL accept an optional route resolver for generic `net/http`
middleware, SHALL use a conservative fallback when no framework pattern is
available, and SHALL provide a dedicated Echo adapter when Echo is used.

#### Scenario: Router supplies a route resolver
- **WHEN** a configured resolver returns `/orders/:id`
- **THEN** the SDK uses that route name rather than the concrete request path

#### Scenario: Echo adapter resolves a route
- **WHEN** an Echo context reports `/orders/:id`
- **THEN** the SDK uses the Echo template without requiring a custom resolver
