# Endpoint ingestion Specification

## Purpose

Define authenticated, aggregate-only endpoint telemetry ingestion and bounded performance queries.

## Requirements

### Requirement: Versioned authenticated batches
Ingest SHALL verify the environment-scoped key against its D1 SHA-256 verifier, validate the schema version and bounded event fields, enforce a bounded request body before JSON parsing, reject unknown unsafe content, and accept valid Node and Go batches under the same contract.

#### Scenario: Valid mixed-runtime contract fixtures
- **WHEN** canonical Node and Go fixtures carry equivalent endpoint summaries
- **THEN** ingest validates both into the same internal event shape

### Requirement: Idempotent batch processing
Ingest SHALL deduplicate a retry-stable batch identifier in D1 for a bounded window so retrying a batch does not increase Analytics Engine metrics twice. D1 SHALL store at most one dedupe row per accepted batch, not per event.

#### Scenario: SDK retries a batch
- **WHEN** the same valid batch ID is accepted twice within the deduplication window
- **THEN** Analytics Engine counts increase once and D1 contains one dedupe row

### Requirement: Aggregate-only storage
The system SHALL aggregate equivalent validated events in memory and write only aggregate-safe points to Workers Analytics Engine. D1 SHALL retain control-plane records, unique normalized endpoint identities, and short-lived batch IDs only; it SHALL NOT retain one row per request event.

#### Scenario: One hundred events arrive in one batch
- **WHEN** the batch passes authentication, validation, and deduplication
- **THEN** D1 creates one temporary dedupe row regardless of event count

### Requirement: Bounded failure detail
Ingest SHALL retain one parameter-free detail row for every 4xx/5xx event for 24 hours while 2xx/3xx events remain aggregate-only. Every status SHALL still contribute to request counts and fixed latency histograms used for pXX estimates.

#### Scenario: Mixed-status batch is accepted
- **WHEN** one batch contains 2xx, 4xx, and 5xx events
- **THEN** all events affect aggregates and only 4xx/5xx events create detail rows

### Requirement: Correct window merging
The query layer SHALL use fixed allowlisted Analytics Engine SQL, weight sampled counts by `_sample_interval`, and merge fixed histogram buckets to compute request count, error rate, approximate p50 and p95 latency, and last seen for 15-minute, 1-hour, and 24-hour windows.

#### Scenario: Endpoint spans multiple sampled data points
- **WHEN** an endpoint has latency samples across multiple Analytics Engine rows
- **THEN** the selected-window percentile is derived from weighted merged histogram counts rather than averaged row percentiles

### Requirement: Project and environment isolation
Ingest and endpoint queries SHALL scope every operation to the key-resolved or owner-resolved app and environment, using an opaque scope identifier as the Analytics Engine sampling index.

#### Scenario: Endpoint data belongs to another environment
- **WHEN** an owner queries one app and environment
- **THEN** the API returns no metrics from another app or environment

### Requirement: Analytics Engine writes remain bounded
The Worker SHALL emit no more than 250 Analytics Engine data points in one invocation and SHALL reject or aggregate input so the platform limit cannot be exceeded.

#### Scenario: Batch has many equivalent events
- **WHEN** a valid batch can be reduced by method, route, latency bucket, runtime, and release
- **THEN** the Worker writes the reduced aggregate points within the invocation bound
