# Node endpoint SDK Specification

## Purpose

Define privacy-preserving, fail-open endpoint performance capture for Node and Express services.

## Requirements

### Requirement: Express request performance capture
The public Node package SHALL provide Express middleware through `@saas-maker/app-health/express` that records method, normalized route template, status code, duration, timestamp, and optional release after the response completes while the root client remains framework-independent.

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
The Node SDK SHALL support installation from `@saas-maker/app-health`, configuration with an ingest key, endpoint, and bounded environment, and an optional Express adapter. Every product-key batch SHALL declare that environment while release remains optional.

#### Scenario: Minimal Express installation
- **WHEN** the operator installs the package and mounts middleware with a valid key and environment
- **THEN** observed Express requests are batched without requiring route registration, a contracts package, or Node startup flags

### Requirement: Express records trusted templates only
The Express adapter SHALL record matched Express route templates and SHALL drop an event when no matched string template is available rather than sending a concrete fallback path.

#### Scenario: Unmatched request contains a private slug
- **WHEN** Express returns a 404 for `/users/alice-private`
- **THEN** the adapter records no event containing `alice-private`

### Requirement: Node string fields are privacy bounded
The Node SDK SHALL normalize route templates and SHALL omit optional release tags that contain characters outside the bounded release-token character set.

#### Scenario: Configuration contains an unsafe release string
- **WHEN** a release contains whitespace, path separators, query delimiters, or an email marker
- **THEN** the SDK omits the release while continuing to batch valid endpoint events

### Requirement: Retry-stable Node batch identity
The Node SDK SHALL assign one UUID batch identifier before delivery and reuse it for every retry of that serialized batch.

#### Scenario: Delivery retries
- **WHEN** one Node batch is attempted multiple times
- **THEN** every attempt carries the same batch ID
