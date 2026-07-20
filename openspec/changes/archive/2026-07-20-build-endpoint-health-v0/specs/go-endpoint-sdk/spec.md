## ADDED Requirements

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
The Go SDK SHALL accept an optional route resolver and SHALL use a conservative fallback when no framework pattern is available.

#### Scenario: Router supplies a route resolver
- **WHEN** a configured resolver returns `/orders/:id`
- **THEN** the SDK uses that route name rather than the concrete request path
