## ADDED Requirements

### Requirement: OTLP traces remain on the ingest hostname
The Cloudflare Worker SHALL serve authenticated OTLP/HTTP traces only on the configured ingest hostname and SHALL apply the same direct-Worker-host rejection used by native ingest and owner boundaries.

#### Scenario: OTLP request targets the dashboard hostname
- **WHEN** a client posts traces to the owner dashboard hostname or direct Worker hostname
- **THEN** the Worker returns not found and performs no telemetry write

### Requirement: OTLP processing is bounded for Workers
The Worker SHALL bound compressed body size, expanded body size, decoded span count, generated aggregate points, and error-message size before or during OTLP processing.

#### Scenario: Trace export exceeds a Worker processing bound
- **WHEN** any configured OTLP request or expansion limit is exceeded
- **THEN** the request stops with a bounded protocol response and no partial storage

### Requirement: OTLP support adds no subscription
The OTLP receiver SHALL run within the existing Worker, D1, and Analytics Engine architecture and SHALL NOT activate another Cloudflare product subscription or standing overage authorization.

#### Scenario: Proposed decoder requires a separately billed service
- **WHEN** implementation would require another paid Cloudflare product
- **THEN** the release is blocked and the design is revised to remain within the existing plan

### Requirement: Native production ingest remains independently releasable
Adding or disabling OTLP traces SHALL NOT break, redirect, or require migration of existing native `/v1/ingest` clients and keys.

#### Scenario: OTLP route is rolled back
- **WHEN** production disables the OTLP route or restores the prior Worker version
- **THEN** existing Node and Go native clients continue ingesting normally
