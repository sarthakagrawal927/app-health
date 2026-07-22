## MODIFIED Requirements

### Requirement: Express request performance capture
The public Node package SHALL provide Express middleware through
`@saas-maker/app-health/express` that records method, normalized route template,
status code, duration, timestamp, and optional release after the response
completes while the root client remains framework-independent.

#### Scenario: Express route receives traffic
- **WHEN** requests complete for `/users/:id` with different concrete IDs
- **THEN** the SDK emits one normalized `GET /users/:id` endpoint identity

### Requirement: Node installation API
The Node SDK SHALL support installation from `@saas-maker/app-health`,
configuration with an ingest key and endpoint, and an optional Express adapter,
while environment and release MAY be supplied explicitly without additional
required setup.

#### Scenario: Minimal Express installation
- **WHEN** the operator installs the package and mounts middleware with a valid key
- **THEN** observed Express requests are batched without requiring route registration, a contracts package, or Node startup flags

### Requirement: Express records trusted templates only
The Express adapter SHALL record matched Express route templates and SHALL drop
an event when no matched string template is available rather than sending a
concrete fallback path.

#### Scenario: Unmatched request contains a private slug
- **WHEN** Express returns a 404 for `/users/alice-private`
- **THEN** the adapter records no event containing `alice-private`

### Requirement: Node string fields are privacy bounded
The Node SDK SHALL normalize route templates and SHALL omit optional release
tags that contain characters outside the bounded release-token character set.

#### Scenario: Configuration contains an unsafe release string
- **WHEN** a release contains whitespace, path separators, query delimiters, or an email marker
- **THEN** the SDK omits the release while continuing to batch valid endpoint events
