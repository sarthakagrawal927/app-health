## ADDED Requirements

### Requirement: Versioned authenticated batches
Ingest SHALL authenticate the environment-scoped key, validate the schema version and bounded event fields, reject unknown unsafe content, and accept valid Node and Go batches under the same contract.

#### Scenario: Valid mixed-runtime contract fixtures
- **WHEN** canonical Node and Go fixtures carry equivalent endpoint summaries
- **THEN** ingest validates both into the same internal event shape

### Requirement: Idempotent event processing
Ingest SHALL deduplicate retried event identifiers for a bounded window so a retry does not increase endpoint metrics twice.

#### Scenario: SDK retries a batch
- **WHEN** the same valid event ID is accepted twice within the deduplication window
- **THEN** aggregate request and latency counts increase only once

### Requirement: Aggregate-only storage
The system SHALL update one-minute endpoint buckets containing count, error count, last seen, duration sum, and mergeable fixed latency-histogram counts, and SHALL NOT durably store raw request events.

#### Scenario: Valid event is processed
- **WHEN** an endpoint summary passes authentication and validation
- **THEN** its aggregate bucket changes and no raw event record or request content is stored

### Requirement: Correct window merging
The query layer SHALL merge relevant buckets to compute request count, error rate, approximate p50 and p95 latency, and last seen for 15-minute, 1-hour, and 24-hour windows.

#### Scenario: Endpoint spans multiple buckets
- **WHEN** an endpoint has latency samples across several one-minute buckets
- **THEN** the selected-window percentile is derived from merged histogram counts rather than averaged bucket percentiles

### Requirement: Project and environment isolation
Ingest and endpoint queries SHALL scope every operation to the key-resolved or owner-resolved app and environment.

#### Scenario: Endpoint identifier belongs to another app
- **WHEN** a query attempts to use an endpoint identifier from a different app
- **THEN** the API returns no cross-app metrics
