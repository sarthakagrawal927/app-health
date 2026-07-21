## ADDED Requirements

### Requirement: Owner-scoped recent failure details
The system SHALL expose an owner-authenticated, app-and-environment-scoped query
for a bounded latest set of retained 4xx/5xx failures. Each row SHALL contain
only failure ID, method, normalized route, status code, duration, occurrence
time, and optional release.

#### Scenario: Owner opens retained data
- **WHEN** the selected environment has retained 4xx/5xx failures
- **THEN** the dashboard returns the latest bounded rows without data from another app or environment

#### Scenario: Unauthorized caller requests failures
- **WHEN** a caller without valid owner authorization requests retained failures
- **THEN** the Worker rejects the request without returning failure metadata

### Requirement: Successful requests remain aggregate-only
The transparency view SHALL explain and demonstrate that 2xx/3xx requests
contribute to request counts, error counts, and fixed latency histograms but do
not have individually retained event rows.

#### Scenario: Environment has only successful traffic
- **WHEN** aggregate endpoint metrics exist and no failure rows are retained
- **THEN** the view shows the aggregate evidence and an explicit no-individual-success-rows explanation

### Requirement: Complete field and retention ledger
The dashboard SHALL list every accepted event field, its purpose, its durable
destination, and its retention class. It SHALL separately list request bodies,
response bodies, headers, cookies, query values, route parameter values, user
identity, logs, stacks, and raw ingest keys as never collected or never stored.

#### Scenario: Owner reviews collection policy
- **WHEN** the owner opens the data-received view
- **THEN** accepted, aggregate-only, short-lived, one-time, and never-collected data are visually distinguishable

### Requirement: Bounded on-demand reads
The recent-failure query SHALL apply a server-enforced maximum result size and
the dashboard SHALL fetch failure details only when the data-received view is
opened or explicitly refreshed.

#### Scenario: Endpoint dashboard polls health
- **WHEN** the endpoint view performs its regular 10-second refresh
- **THEN** it does not query D1 failure details

### Requirement: Honest empty and error states
The transparency view SHALL distinguish no retained failures from query failure
and SHALL never present missing data as proof that ingestion is healthy.

#### Scenario: Failure query is unavailable
- **WHEN** endpoint aggregates load but the failure query fails
- **THEN** the view retains the policy ledger and shows a bounded failure-detail error with retry
