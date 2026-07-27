## MODIFIED Requirements

### Requirement: Owner-scoped recent failure details
The system SHALL expose an owner-authenticated, app-and-environment-scoped query for a bounded latest set of retained 4xx/5xx failures. Each row SHALL contain only failure ID, method, normalized route, status code, duration, occurrence time, and optional release. The query SHALL accept only the supported 15-minute, 1-hour, and 24-hour periods, SHALL default omitted periods to 24 hours, and SHALL return only rows whose occurrence time falls within the resolved period.

#### Scenario: Owner opens retained data
- **WHEN** the selected environment has retained 4xx/5xx failures within the selected period
- **THEN** the dashboard returns the latest bounded rows without data from another app, environment, or period

#### Scenario: Unauthorized caller requests failures
- **WHEN** a caller without valid owner authorization requests retained failures
- **THEN** the Worker rejects the request without returning failure metadata

#### Scenario: Caller requests an unsupported period
- **WHEN** an authenticated caller requests a failure period other than 15 minutes, 1 hour, or 24 hours
- **THEN** the Worker rejects the query without reading retained failure rows

#### Scenario: Legacy caller omits the period
- **WHEN** an authenticated caller requests retained failures without a period
- **THEN** the Worker applies the existing 24-hour retention window

### Requirement: Honest empty and error states
The transparency view SHALL distinguish no retained failures in the selected period from query failure and SHALL never present missing data as proof that ingestion is healthy.

#### Scenario: Selected period has no retained failures
- **WHEN** the failure query succeeds with no rows in the selected period
- **THEN** the view identifies the active period and does not claim that longer periods contain no failures

#### Scenario: Failure query is unavailable
- **WHEN** endpoint aggregates load but the failure query fails
- **THEN** the view retains the policy ledger and shows a bounded failure-detail error with retry
