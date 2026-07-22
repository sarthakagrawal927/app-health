## ADDED Requirements

### Requirement: Deduplicated incident notifications
The system SHALL create one active incident notification thread per Problem and SHALL suppress repeated event spam while preserving material status changes.

#### Scenario: Problem receives repeated events
- **WHEN** an already-alerted active Problem receives equivalent events without a material state change
- **THEN** no new incident email is sent

### Requirement: Daily owner summary
The system SHALL produce a daily environment-scoped summary that reports a healthy state or the top useful Problems in owner language with direct evidence links.

#### Scenario: Daily summary runs for healthy project
- **WHEN** the scheduled summary finds no useful active Problem
- **THEN** it sends or renders a calm healthy summary rather than technical metric noise

### Requirement: Notification preferences and authorization
Authorized members SHALL be able to manage incident and daily-summary preferences, and unsubscribe actions SHALL not grant broader project access.

#### Scenario: Recipient unsubscribes from incident mail
- **WHEN** a valid scoped unsubscribe token is used
- **THEN** the preference changes without exposing project data or altering other recipients

### Requirement: Product success instrumentation
The product SHALL record the specified activation, owner-view, evidence, explanation-feedback, fix-handoff, deployment, recovery, ignore, and unsubscribe events without including captured customer payload values.

#### Scenario: Fix prompt is copied
- **WHEN** an owner copies a prepared fix prompt
- **THEN** `fix_prompt_copied` is recorded with scoped product identifiers and no request or response content
