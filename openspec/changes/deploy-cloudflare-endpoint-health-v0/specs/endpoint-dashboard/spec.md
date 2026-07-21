## MODIFIED Requirements

### Requirement: Observed endpoint inventory
The private dashboard SHALL list every method and normalized route observed by
Analytics Engine for the selected durable app and environment and SHALL
describe the list as observed traffic rather than source-code route inventory.

#### Scenario: Multiple endpoints send traffic
- **WHEN** accepted telemetry contains three distinct method and normalized-route pairs
- **THEN** the selected environment displays three endpoint rows

### Requirement: Endpoint performance metrics
Each endpoint row SHALL show sampling-aware request count, error rate,
approximate p50 latency, approximate p95 latency, last seen, and deterministic
health state for the selected time window.

#### Scenario: Operator changes time window
- **WHEN** the operator switches from 15 minutes to 24 hours
- **THEN** all row metrics and health states use the 24-hour Analytics Engine response

### Requirement: Waiting and disconnected states
The dashboard SHALL distinguish no traffic yet, stale traffic, invalid or
revoked key, Analytics Engine query unavailability, and temporary API failure
with a bounded next action.

#### Scenario: New app has no telemetry
- **WHEN** no valid endpoint event has been received
- **THEN** the page shows the install snippet and a waiting-for-traffic state rather than an empty healthy table

## ADDED Requirements

### Requirement: Production SDK snippets use the ingest origin
The setup view SHALL render Node and Go snippets with the configured production
ingest origin and the one-time key without persisting the raw key in browser
storage or analytics.

#### Scenario: Operator creates a production app
- **WHEN** the creation response returns the one-time key
- **THEN** the visible snippets target the configured ingest origin and the key disappears after the one-time setup state is left
