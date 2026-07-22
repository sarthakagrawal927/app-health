## ADDED Requirements

### Requirement: Owner-friendly project setup
The system SHALL let an authenticated owner create a workspace, project, production or staging environment, and write key without requiring observability terminology.

#### Scenario: New owner reaches installation
- **WHEN** an authenticated owner completes the minimum project fields
- **THEN** the system creates the scoped records and presents GitHub, coding-agent, and manual installation choices

### Requirement: Role-based administration
The system SHALL support Owner, Admin, and Viewer roles, and SHALL restrict membership, capture, retention, key, and deletion changes to authorized roles.

#### Scenario: Viewer attempts an administrative change
- **WHEN** a Viewer submits a retention or membership change
- **THEN** the server rejects it without changing state

### Requirement: Server-enforced tenant and environment isolation
Every owner query and object read SHALL derive workspace, project, and environment scope from authenticated server context, and SHALL keep production and staging separate by default.

#### Scenario: Cross-project identifier is supplied
- **WHEN** a valid member requests an object identifier owned by another project
- **THEN** the server returns no object and records no cross-tenant disclosure

### Requirement: Safe write-key lifecycle
Write keys SHALL be displayed only at creation, stored as non-reversible verifiers, scoped to one project and environment, and revocable without deleting historical data.

#### Scenario: Revoked key sends a batch
- **WHEN** ingest receives a batch signed by a revoked write key
- **THEN** it rejects the batch before queueing or storage
