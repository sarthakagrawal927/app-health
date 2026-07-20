## ADDED Requirements

### Requirement: Fixed owner navigation
The owner application SHALL provide Today, Problems, Deployments, Advanced, and Settings as fixed workflows rather than configurable dashboards.

#### Scenario: Owner opens the application
- **WHEN** the selected environment has traffic
- **THEN** Today is the default view and presents owner-level health before technical telemetry

### Requirement: Calm and plain-language Today view
Today SHALL state overall health, three to five headline facts, ranked active Problems, failed actions or known affected users, recent deployment context, and a daily summary without requiring p95, status-class, trace, log, or SLO interpretation.

#### Scenario: Application is healthy
- **WHEN** no Problem crosses a usefulness threshold
- **THEN** Today presents a calm healthy state and relevant recent facts without manufacturing an issue

### Requirement: Grouped Problems workflow
The Problems view SHALL show grouped incidents with owner title, impact, first seen, status, likely cause, confidence, and primary action, and SHALL not default to a raw event stream.

#### Scenario: Owner opens a Problem
- **WHEN** an active Problem card is selected
- **THEN** the detail view leads with what happened, impact, likely cause, evidence, next step, fix handoff, and recovery status

### Requirement: Progressive technical evidence
Advanced SHALL provide endpoint ranking, individual failures, sanitized request and response evidence, normalized stack traces, and supported dependency spans as drill-down views.

#### Scenario: Owner remains in primary workflow
- **WHEN** the owner reads Today and Problem detail summaries
- **THEN** understanding the impact and next action does not require opening Advanced

### Requirement: Installation verification
Onboarding SHALL verify ingest, route detection, environment, release metadata, and active privacy mode with a test event before declaring installation complete.

#### Scenario: Test event lacks release metadata
- **WHEN** the SDK test event arrives without a release
- **THEN** setup reports the successful checks and leaves release metadata visibly incomplete
