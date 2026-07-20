## ADDED Requirements

### Requirement: Canonical request summaries
The Express SDK SHALL capture the versioned canonical request summary fields available at the request boundary, normalize dynamic route values, and record thrown errors without requiring application-specific middleware order in the recommended path.

#### Scenario: Dynamic route request completes
- **WHEN** requests reach `/orders/123` and `/orders/456` through the same Express route template
- **THEN** the SDK emits the same normalized route template for both summaries

### Requirement: Asynchronous fail-open delivery
The SDK SHALL batch telemetry outside the application response path, bound memory and retry work, and SHALL NOT fail or delay an application request because ingest is slow, unavailable, or rate-limited.

#### Scenario: Ingest is unavailable
- **WHEN** the ingest endpoint times out while application requests continue
- **THEN** application responses preserve their original behavior and telemetry failure remains contained to the SDK

### Requirement: Optional privacy-aware context
The SDK SHALL accept explicit action labels and optional user identity callbacks, SHALL transmit only a keyed hash of a source user identifier, and SHALL omit user impact when identity is unavailable.

#### Scenario: No identity callback is configured
- **WHEN** failed requests are captured without a user identity callback
- **THEN** emitted summaries contain no user identifier and downstream views count failed actions rather than affected users

### Requirement: Instrumentation overhead budget
Boundary-only instrumentation SHALL target p95 overhead below 2 milliseconds in a representative local Express benchmark.

#### Scenario: Representative benchmark runs
- **WHEN** the benchmark compares instrumented and uninstrumented request handling under the documented load
- **THEN** it reports the p95 delta and fails the performance gate when the target is exceeded
