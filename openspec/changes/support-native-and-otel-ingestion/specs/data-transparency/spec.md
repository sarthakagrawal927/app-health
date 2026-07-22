## ADDED Requirements

### Requirement: OpenTelemetry mapping ledger
The Data received view SHALL list every OpenTelemetry field used to derive an App Health observation, its canonical destination, and its retention class. It SHALL separately identify trace context, raw URL data, network attributes, events, links, baggage, exception content, and non-HTTP span attributes as immediately discarded or unsupported.

#### Scenario: Owner reviews OpenTelemetry collection
- **WHEN** an environment has connected through OTLP traces
- **THEN** the transparency view shows the allowlisted server-span mapping and immediate discard boundary

### Requirement: OpenTelemetry does not expand retained failure content
Failures derived from OpenTelemetry SHALL retain the same bounded fields and 24-hour behavior as native failures and SHALL NOT retain trace IDs, span IDs, exception messages, stack traces, attributes, events, or links.

#### Scenario: Failed server span contains exception details
- **WHEN** an eligible 5xx server span is accepted with exception events and trace context
- **THEN** the failure row contains only failure ID, method, normalized route, status, duration, occurrence time, and optional release

### Requirement: Source parity is visible without raw telemetry
The dashboard SHALL identify Native SDK or OpenTelemetry as the installation source while using the same endpoint and failure views and without exposing complete span payloads.

#### Scenario: Operator compares two source environments
- **WHEN** equivalent traffic arrives through native and OpenTelemetry paths
- **THEN** both environments expose the same App Health metrics and retention explanations with only bounded source labeling differing
