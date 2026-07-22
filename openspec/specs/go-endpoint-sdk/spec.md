# Go endpoint SDK Specification

## Purpose

Define privacy-preserving, fail-open endpoint performance capture for Go HTTP services.

## Requirements

### Requirement: Go HTTP request performance capture
The Go SDK SHALL provide `net/http` middleware that records method, normalized route pattern, status code, duration, timestamp, and optional release while preserving standard handler behavior.

#### Scenario: Standard ServeMux route receives traffic
- **WHEN** a Go 1.22 `ServeMux` pattern handles requests with different path values
- **THEN** the SDK uses the matched request pattern as one endpoint identity

### Requirement: Go response behavior preservation
The middleware SHALL preserve status, headers, body, optional interfaces required by supported handlers, and panic behavior while recording the final status when possible.

#### Scenario: Handler returns a custom status
- **WHEN** a wrapped handler writes status 418 and a response body
- **THEN** the client receives the same status and body and telemetry records status 418

### Requirement: No request content capture
The Go SDK MUST NOT collect headers, cookies, query values, path parameter values, request or response bodies, user identity, logs, stack traces, or spans.

#### Scenario: Request contains sensitive content
- **WHEN** an instrumented request includes authorization, query, and body values
- **THEN** the serialized telemetry batch contains none of those values

### Requirement: Asynchronous fail-open Go delivery
The Go SDK SHALL use a bounded queue, short delivery timeout, bounded retries, explicit close or flush, and SHALL NOT fail or wait on an application response because telemetry delivery fails.

#### Scenario: Queue is full
- **WHEN** more summaries arrive than the configured queue can hold
- **THEN** the SDK drops telemetry without changing handler responses or blocking indefinitely

### Requirement: Third-party router naming escape hatch
The Go SDK SHALL accept an optional route resolver for generic `net/http` middleware, SHALL drop events when no trusted framework pattern is available, and SHALL provide a dedicated Echo adapter when Echo is used.

#### Scenario: Router supplies a route resolver
- **WHEN** a configured resolver returns `/orders/:id`
- **THEN** the SDK uses that route name rather than the concrete request path

#### Scenario: Echo adapter resolves a route
- **WHEN** an Echo context reports `/orders/:id`
- **THEN** the SDK uses the Echo template without requiring a custom resolver

#### Scenario: Generic handler has no trusted route template
- **WHEN** a generic `net/http` handler completes without a resolver or ServeMux pattern
- **THEN** the SDK drops the event instead of sending its concrete request path

### Requirement: Echo request performance capture
The Go SDK SHALL provide Echo v4 middleware that records method, Echo's normalized matched route template, final status code, duration, timestamp, and optional release while preserving Echo handler behavior.

#### Scenario: Echo parameterized route receives traffic
- **WHEN** Echo handles requests for `/users/:id` with different concrete IDs
- **THEN** the SDK emits one normalized `GET /users/:id` endpoint identity

#### Scenario: Echo handler returns an HTTP error
- **WHEN** an Echo handler returns an `echo.HTTPError` before committing a response
- **THEN** the adapter records the error status and returns the same error for Echo's normal error handling

### Requirement: Framework adapters use bounded public recording
The Go core SHALL expose a concurrency-safe non-blocking record operation that applies the same validation, queue bound, privacy rules, and diagnostics as its standard `net/http` middleware.

#### Scenario: Echo adapter records while ingest is unavailable
- **WHEN** Echo requests complete while delivery fails
- **THEN** responses and returned errors remain unchanged and telemetry loss is bounded in diagnostics

### Requirement: Go string fields are privacy bounded
The Go SDK SHALL validate route templates and SHALL omit optional release tags that contain characters outside the bounded release-token character set.

#### Scenario: Configuration contains an unsafe release string
- **WHEN** a release contains whitespace, path separators, query delimiters, or an email marker
- **THEN** the SDK omits the release while preserving request handling and endpoint delivery

### Requirement: Retry-stable Go batch identity
The Go SDK SHALL assign one UUID batch identifier before delivery and reuse it for every retry of that serialized batch.

#### Scenario: Delivery retries
- **WHEN** one Go batch is attempted multiple times
- **THEN** every attempt carries the same batch ID
