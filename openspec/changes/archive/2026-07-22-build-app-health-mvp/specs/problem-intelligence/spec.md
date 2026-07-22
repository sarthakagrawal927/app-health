## ADDED Requirements

### Requirement: Deterministic problem grouping
The system SHALL group materially equivalent failures using normalized route or action, exception type and message, top application frame, failing dependency, and status class, while keeping dependency timeouts distinct from application exceptions.

#### Scenario: Repeated equivalent failures arrive
- **WHEN** fifty events share the same normalized fingerprint and cause evidence
- **THEN** the system presents one Problem with accurate event and impact counts

### Requirement: Deterministic and suppressible detectors
The system SHALL detect new errors, failure spikes, dependency failures, timeouts, rate limits, and meaningful latency regressions using versioned deterministic triggers with a false-positive suppression path.

#### Scenario: Rate-limit failures cross threshold
- **WHEN** a normalized action crosses the configured deterministic 429 threshold
- **THEN** one rate-limit Problem becomes active and its trigger facts remain inspectable

### Requirement: Impact-first ranking
Problem ranking SHALL prioritize unique known users or failed actions, action criticality, recency, confidence, and persistence rather than raw event volume alone.

#### Scenario: Critical low-volume action competes with noisy route
- **WHEN** a checkout failure has lower volume but greater weighted impact than a non-critical warning
- **THEN** the checkout Problem ranks first

### Requirement: Evidence-backed lifecycle
Problems SHALL support Active, Monitoring, Resolved, and Ignored states, and SHALL leave Active only because of new deployment or recovery evidence rather than elapsed time alone.

#### Scenario: Events stop without sufficient follow-up traffic
- **WHEN** a Problem has no recent recurrence but has not met the observation and traffic thresholds
- **THEN** it does not become Resolved

### Requirement: Correctable semantic mappings
The system SHALL suggest owner-facing action labels and SHALL persist authorized rename, split, merge, and ignore corrections for future grouping.

#### Scenario: Owner renames a route action
- **WHEN** an authorized owner changes the suggested action label
- **THEN** current and future matching Problems use the saved label without changing raw evidence
