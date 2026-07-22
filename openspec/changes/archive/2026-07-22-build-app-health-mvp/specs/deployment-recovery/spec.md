## ADDED Requirements

### Requirement: Versioned deployment evidence
The system SHALL record project, environment, release identifier, timestamp, and available source metadata for detected or reported deployments.

#### Scenario: SDK reports a new release
- **WHEN** the first accepted event for an unseen release arrives
- **THEN** the system records one idempotent deployment marker for that environment

### Requirement: Evidence-only deployment correlation
Problem detail and Deployments SHALL show temporal relationship, before and after rates, changed evidence when known, and evidence strength without treating proximity as proof.

#### Scenario: Problem worsens near release
- **WHEN** the post-release failure rate rises above the comparison baseline
- **THEN** the release is shown as associated with the Problem and the computed comparison remains inspectable

### Requirement: Recovery monitoring
A later deployment or configuration marker SHALL move an active Problem to Monitoring only after follow-up traffic begins, and SHALL resolve it only after a minimum observation window and meaningful healthy volume pass without recurrence or return to baseline.

#### Scenario: Healthy traffic verifies a fix
- **WHEN** the configured observation and traffic thresholds pass after a later release with no material recurrence
- **THEN** the Problem becomes Resolved with the recovery evidence and timestamp

### Requirement: Recurrence after monitoring
The system SHALL return a Monitoring Problem to Active when materially equivalent failures recur before resolution.

#### Scenario: Failure recurs during observation
- **WHEN** a matching event crosses the recurrence threshold during Monitoring
- **THEN** the Problem becomes Active and preserves the attempted recovery history
