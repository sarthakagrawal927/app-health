## ADDED Requirements

### Requirement: Observed endpoint inventory
The dashboard SHALL list every method and normalized route observed for the selected app and environment and SHALL describe the list as observed traffic rather than source-code route inventory.

#### Scenario: Multiple endpoints send traffic
- **WHEN** accepted telemetry contains three distinct method and normalized-route pairs
- **THEN** the selected environment displays three endpoint rows

### Requirement: Endpoint performance metrics
Each endpoint row SHALL show request count, error rate, approximate p50 latency, approximate p95 latency, last seen, and deterministic health state for the selected time window.

#### Scenario: Operator changes time window
- **WHEN** the operator switches from 15 minutes to 24 hours
- **THEN** all row metrics and health states use the 24-hour aggregate response

### Requirement: Deterministic health states
The dashboard SHALL label fewer than 20 requests as `insufficient-data`; otherwise it SHALL label error rate >= 5% or p95 >= 2000 ms as `unhealthy`, error rate >= 1% or p95 >= 1000 ms as `degraded`, and lower values as `healthy`.

#### Scenario: Low traffic endpoint is slow
- **WHEN** an endpoint has 10 requests and p95 above 2000 ms
- **THEN** it remains `insufficient-data` and still shows its measured metrics

### Requirement: Useful sorting and freshness
The dashboard SHALL support sorting by health, request count, error rate, p95 latency, and last seen, and SHALL show when metrics were last refreshed.

#### Scenario: Sort by error rate
- **WHEN** the operator selects error-rate sorting
- **THEN** endpoints appear in descending error-rate order with stable tie breaking

### Requirement: Waiting and disconnected states
The dashboard SHALL distinguish no traffic yet, stale traffic, invalid or revoked key, and temporary API failure with a bounded next action.

#### Scenario: New app has no telemetry
- **WHEN** no valid endpoint event has been received
- **THEN** the page shows the install snippet and a waiting-for-traffic state rather than an empty healthy table

### Requirement: Polished responsive presentation
The dashboard SHALL use a cohesive visual system, accessible contrast and focus states, clear information hierarchy, and intentional responsive layouts for setup, waiting, populated, stale, and error states.

#### Scenario: Narrow viewport shows populated endpoints
- **WHEN** the populated dashboard is viewed at a mobile width
- **THEN** endpoint identity, health, key metrics, and primary controls remain readable and operable without clipped content or horizontal page scrolling

### Requirement: Screenshot evidence
The implementation SHALL produce browser-verified desktop and mobile screenshots of setup, waiting-for-traffic, and populated endpoint states for parent review.

#### Scenario: Dashboard work is submitted for review
- **WHEN** the dashboard agent reports its work complete
- **THEN** six current screenshots cover the three required states at desktop and mobile widths
