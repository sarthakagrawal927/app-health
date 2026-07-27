## MODIFIED Requirements

### Requirement: Endpoint performance metrics
Each endpoint row SHALL show sampling-aware request count, error rate, approximate p50 latency, approximate p95 latency, last seen, and deterministic health state for the selected time window when metrics are available. Missing sampled metrics SHALL be rendered as unavailable rather than zero. The private dashboard SHALL expose one accessible 15-minute, 1-hour, or 24-hour period selection in both the Endpoints and Data received views, and the selection SHALL remain unchanged when the operator switches views.

#### Scenario: Operator changes time window
- **WHEN** the operator switches from 15 minutes to 24 hours
- **THEN** all row metrics and health states use the 24-hour Analytics Engine response

#### Scenario: Operator switches dashboard views
- **WHEN** the operator selects 1 hour and switches between Endpoints and Data received
- **THEN** both views retain and query the 1-hour period
