## MODIFIED Requirements

### Requirement: Versioned authenticated batches
Ingest SHALL verify the environment-scoped key against its D1 SHA-256 verifier,
validate the schema version and bounded event fields, enforce a bounded request
body before JSON parsing, reject unknown unsafe content, and accept valid Node
and Go batches under the same contract.

#### Scenario: Valid mixed-runtime contract fixtures
- **WHEN** canonical Node and Go fixtures carry equivalent endpoint summaries
- **THEN** ingest validates both into the same internal event shape

### Requirement: Idempotent event processing
Ingest SHALL deduplicate retried event identifiers in D1 for a bounded window so
a retry does not increase Analytics Engine metrics twice.

#### Scenario: SDK retries a batch
- **WHEN** the same valid event ID is accepted twice within the deduplication window
- **THEN** Analytics Engine request and latency counts increase only once

### Requirement: Aggregate-only storage
The system SHALL aggregate equivalent validated events in memory and write only
method, normalized route, fixed latency bucket, runtime, optional release,
request count, error count, duration sum, and maximum event timestamp to
Workers Analytics Engine. It SHALL NOT durably store raw request events or
endpoint telemetry in D1.

#### Scenario: Valid event is processed
- **WHEN** an endpoint summary passes authentication, validation, and deduplication
- **THEN** an aggregate-safe Analytics Engine point is written and D1 stores no route, status, duration, histogram, or request content

### Requirement: Correct window merging
The query layer SHALL use fixed allowlisted Analytics Engine SQL, weight sampled
counts by `_sample_interval`, and merge fixed histogram buckets to compute
request count, error rate, approximate p50 and p95 latency, and last seen for
15-minute, 1-hour, and 24-hour windows.

#### Scenario: Endpoint spans multiple sampled data points
- **WHEN** an endpoint has latency samples across multiple Analytics Engine rows
- **THEN** the selected-window percentile is derived from weighted merged histogram counts rather than averaged row percentiles

### Requirement: Project and environment isolation
Ingest and endpoint queries SHALL scope every operation to the key-resolved or
owner-resolved app and environment, using an opaque scope identifier as the
Analytics Engine sampling index.

#### Scenario: Endpoint data belongs to another environment
- **WHEN** an owner queries one app and environment
- **THEN** the API returns no metrics from another app or environment

## ADDED Requirements

### Requirement: Analytics Engine writes remain bounded
The Worker SHALL emit no more than 250 Analytics Engine data points in one
invocation and SHALL reject or aggregate input so the platform limit cannot be
exceeded.

#### Scenario: Batch has many equivalent events
- **WHEN** a valid batch can be reduced by method, route, latency bucket, runtime, and release
- **THEN** the Worker writes the reduced aggregate points within the invocation bound
