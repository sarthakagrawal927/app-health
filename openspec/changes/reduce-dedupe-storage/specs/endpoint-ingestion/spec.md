## MODIFIED Requirements

### Requirement: Idempotent batch processing
Ingest SHALL deduplicate a retry-stable batch identifier in D1 for a bounded
window so retrying a batch does not increase Analytics Engine metrics twice.
D1 SHALL store at most one dedupe row per accepted batch, not per event.

#### Scenario: SDK retries a batch
- **WHEN** the same valid batch ID is accepted twice within the deduplication window
- **THEN** Analytics Engine counts increase once and D1 contains one dedupe row

### Requirement: Aggregate-only storage
The system SHALL aggregate equivalent validated events in memory and write only
aggregate-safe points to Workers Analytics Engine. D1 SHALL retain control-plane
records, unique normalized endpoint identities, and short-lived batch IDs only;
it SHALL NOT retain one row per request event.

#### Scenario: One hundred events arrive in one batch
- **WHEN** the batch passes authentication, validation, and deduplication
- **THEN** D1 creates one temporary dedupe row regardless of event count

### Requirement: Bounded failure detail
Ingest SHALL retain one parameter-free detail row for every 4xx/5xx event for
24 hours while 2xx/3xx events remain aggregate-only. Every status SHALL still
contribute to request counts and fixed latency histograms used for pXX estimates.

#### Scenario: Mixed-status batch is accepted
- **WHEN** one batch contains 2xx, 4xx, and 5xx events
- **THEN** all events affect aggregates and only 4xx/5xx events create detail rows
