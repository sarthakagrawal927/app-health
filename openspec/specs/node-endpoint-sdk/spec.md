# Node endpoint SDK Specification

## Purpose

Define privacy-preserving, fail-open endpoint performance capture for Node and Express services.

## Requirements

### Requirement: Express request performance capture
The Node SDK SHALL provide Express middleware that records method, normalized route template, status code, duration, timestamp, and optional release after the response completes.

#### Scenario: Express route receives traffic
- **WHEN** requests complete for `/users/:id` with different concrete IDs
- **THEN** the SDK emits one normalized `GET /users/:id` endpoint identity

### Requirement: No request content capture
The Node SDK MUST NOT collect headers, cookies, query values, route parameter values, request or response bodies, user identity, log messages, stack traces, or spans.

#### Scenario: Request contains sensitive content
- **WHEN** an instrumented request includes authorization, query, parameter, and body values
- **THEN** the serialized telemetry batch contains none of those values

### Requirement: Asynchronous fail-open Node delivery
The Node SDK SHALL use a bounded in-memory queue, short delivery timeout, bounded retries, and graceful flush, and SHALL NOT fail or wait on an application response because telemetry delivery fails.

#### Scenario: Ingest is unavailable
- **WHEN** the ingest endpoint times out while requests complete
- **THEN** the application responses remain unchanged and the SDK bounds queued telemetry

### Requirement: Node installation API
The Node SDK SHALL support configuration with an ingest key and endpoint, while environment and release MAY be supplied explicitly without additional required setup.

#### Scenario: Minimal Express installation
- **WHEN** the operator installs the package and mounts middleware with a valid key
- **THEN** observed Express requests are batched without requiring route registration or Node startup flags
