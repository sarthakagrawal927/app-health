## ADDED Requirements

### Requirement: Existing OpenTelemetry setup path
The one-time setup view SHALL offer an Existing OpenTelemetry path that renders
a copy-ready standard Collector OTLP/HTTP exporter configuration using the
configured ingest origin and visible environment key, without requiring an App
Health SDK or custom Collector plugin.

#### Scenario: Operator selects OpenTelemetry
- **WHEN** the one-time ingest key is visible and the operator selects Existing OpenTelemetry
- **THEN** the setup view shows an additive Collector exporter and traces-pipeline example targeting the App Health OTLP endpoint

### Requirement: Upstream sampling disclosure
Endpoint rows and cards SHALL visibly label trace-derived request counts, error
rates, percentiles, and health states as sampled estimates rather than exact
values.

#### Scenario: Endpoint includes OTel trace contributions
- **WHEN** the endpoint API returns `upstream_sampled: true`
- **THEN** desktop and mobile endpoint presentations disclose that the metrics and health assessment are based on sampled traces
