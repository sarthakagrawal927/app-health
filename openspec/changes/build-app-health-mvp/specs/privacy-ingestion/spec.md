## ADDED Requirements

### Requirement: Protected values never enter ingest payloads
The SDK SHALL exclude authorization, cookie, set-cookie, API-key-like headers, known secret fields, uploads, binary bodies, and streams before transmission.

#### Scenario: Request contains protected data
- **WHEN** a captured request includes authorization, cookie, token-like, and multipart fields
- **THEN** the serialized outbound batch contains none of their source values

### Requirement: Metadata-only capture by default
Request and response values SHALL remain omitted unless a runtime schema or explicit route allowlist permits specific fields, and successful response bodies SHALL remain disabled by default.

#### Scenario: No capture allowlist exists
- **WHEN** a request contains a JSON body and no allowlist is configured
- **THEN** evidence includes only permitted field names, types, sizes, or omitted markers

### Requirement: Validate and redact before durable use
Ingest SHALL authenticate, size-limit, schema-validate, and apply a versioned second redaction pass before queueing, storage, or model input.

#### Scenario: Batch fails validation
- **WHEN** a batch is oversized, malformed, or contains a prohibited field
- **THEN** ingest rejects it and creates no durable summary or evidence

### Requirement: Selective evidence and retention
The system SHALL retain aggregates, summaries, failed or slow evidence, healthy samples, and body previews under separately configurable policies, and SHALL never retain unredacted bodies or secrets.

#### Scenario: Retention job expires evidence
- **WHEN** an evidence object passes its project policy deadline
- **THEN** the system deletes the object while preserving allowed aggregate history

### Requirement: Fail-safe backpressure
When processing capacity is constrained, the system SHALL drop or reduce healthy detail before dropping failed, slow, or new-fingerprint evidence.

#### Scenario: Queue pressure crosses its limit
- **WHEN** a batch contains healthy samples and new failure evidence during pressure
- **THEN** the processor preserves the failure evidence and records that healthy detail was reduced

### Requirement: Project deletion
An authorized owner SHALL be able to delete a project and its summaries, evidence, keys, problems, releases, and membership links without support intervention.

#### Scenario: Owner confirms deletion
- **WHEN** an Owner completes the confirmation flow
- **THEN** all project-scoped data becomes inaccessible and deletion progress is auditable
