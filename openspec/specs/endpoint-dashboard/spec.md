# Endpoint dashboard Specification

## Purpose

Define the local operator experience for setup, installation state, and observed endpoint performance.
## Requirements
### Requirement: Observed endpoint inventory
The private dashboard SHALL list every method and normalized route accepted for the selected durable app and environment by merging the durable normalized inventory with Analytics Engine metrics. It SHALL describe the list as observed traffic rather than source-code route inventory.

#### Scenario: Multiple endpoints send traffic
- **WHEN** accepted telemetry contains three distinct method and normalized-route pairs
- **THEN** the selected environment displays three endpoint rows

#### Scenario: Analytics Engine samples out a rare endpoint
- **WHEN** the D1 inventory contains an accepted endpoint whose metric row is absent from the selected Analytics Engine response
- **THEN** the endpoint remains visible with its last-seen time and an explicit metrics-sampled state instead of false zero metrics

### Requirement: Endpoint performance metrics
Each endpoint row SHALL show sampling-aware request count, error rate, approximate p50 latency, approximate p95 latency, last seen, and deterministic health state for the selected time window when metrics are available. Missing sampled metrics SHALL be rendered as unavailable rather than zero.

#### Scenario: Operator changes time window
- **WHEN** the operator switches from 15 minutes to 24 hours
- **THEN** all row metrics and health states use the 24-hour Analytics Engine response

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
The dashboard SHALL distinguish no traffic yet, stale traffic, invalid or revoked key, Analytics Engine query unavailability, and temporary API failure with a bounded next action.

#### Scenario: New app has no telemetry
- **WHEN** no valid endpoint event has been received
- **THEN** the page shows the install snippet and a waiting-for-traffic state rather than an empty healthy table

### Requirement: Production SDK snippets use the ingest origin
The setup view SHALL render copy-ready Express, Hono Worker, Pages Function, and
Echo installation snippets with their public package paths, the configured
production ingest origin, and the one-time key without persisting the raw key
in browser storage or analytics.

#### Scenario: Operator creates a production app
- **WHEN** the creation response returns the one-time key
- **THEN** every visible framework snippet targets the configured ingest origin and the key disappears after the one-time setup state is left

#### Scenario: Operator switches framework snippet
- **WHEN** the operator selects Express, Hono, Pages Functions, or Echo
- **THEN** the dashboard shows only the verified install and middleware code for that framework

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

### Requirement: Existing OpenTelemetry setup path
The one-time setup view SHALL offer an Existing OpenTelemetry path that renders a copy-ready standard Collector OTLP/HTTP exporter configuration using the configured ingest origin and visible environment key, without requiring an App Health SDK or custom Collector plugin.

#### Scenario: Operator selects OpenTelemetry
- **WHEN** the one-time ingest key is visible and the operator selects Existing OpenTelemetry
- **THEN** the setup view shows an additive Collector exporter and traces-pipeline example targeting the App Health OTLP endpoint

### Requirement: Upstream sampling disclosure
Endpoint rows and cards SHALL visibly label trace-derived request counts, error rates, percentiles, and health states as sampled estimates rather than exact values.

#### Scenario: Endpoint includes OTel trace contributions
- **WHEN** the endpoint API returns `upstream_sampled: true`
- **THEN** desktop and mobile endpoint presentations disclose that the metrics and health assessment are based on sampled traces

### Requirement: Worker runtime connection state
The installation state SHALL distinguish Cloudflare Worker telemetry from Node,
Go, and OpenTelemetry traffic without changing endpoint health calculations.

#### Scenario: Worker batch is accepted
- **WHEN** the latest accepted environment batch has runtime `worker`
- **THEN** setup reports `Cloudflare Worker connected`
