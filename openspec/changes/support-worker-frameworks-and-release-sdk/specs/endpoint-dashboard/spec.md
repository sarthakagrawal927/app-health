## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Worker runtime connection state
The installation state SHALL distinguish Cloudflare Worker telemetry from Node,
Go, and OpenTelemetry traffic without changing endpoint health calculations.

#### Scenario: Worker batch is accepted
- **WHEN** the latest accepted environment batch has runtime `worker`
- **THEN** setup reports `Cloudflare Worker connected`
