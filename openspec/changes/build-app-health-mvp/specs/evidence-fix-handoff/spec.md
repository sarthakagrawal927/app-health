## ADDED Requirements

### Requirement: Structured owner explanation
Every Problem SHALL provide a title, what happened, impact, likely cause, confidence with reason, two to five evidence facts, and a recommended next step from computed telemetry facts.

#### Scenario: Generation provider is unavailable
- **WHEN** optional narrative generation fails or evidence is insufficient
- **THEN** the system presents a deterministic structured fallback without inventing facts

### Requirement: Explicit uncertainty
Explanations SHALL distinguish evidence, correlation, and deterministic causation and SHALL NOT claim a root cause solely because a deployment occurred nearby.

#### Scenario: Failure begins after a deployment
- **WHEN** timing is the only release relationship
- **THEN** the explanation uses associated or likely language and reports low or medium confidence with its reason

### Requirement: Sanitized representative evidence
Problem detail SHALL expose only allowlisted request metadata, redacted previews, normalized stack, release, region, similar-event counts, and supported dependency timing.

#### Scenario: Evidence contains protected source fields
- **WHEN** stored source material includes a field that current policy prohibits
- **THEN** the API omits the field before returning or sending evidence to a model

### Requirement: Coding-agent fix handoff
The system SHALL generate a copyable structured prompt containing symptom, impact, reproduction clues, sanitized samples, stack, release relationship, confidence, and requested verification steps.

#### Scenario: Owner copies a fix prompt
- **WHEN** the owner invokes Prepare fix
- **THEN** the prompt asks for the smallest safe change and post-deployment verification while excluding protected values and unsupported claims

### Requirement: Explanation feedback
The owner SHALL be able to rate an explanation Accurate, Useful but incomplete, or Wrong, and feedback SHALL be used for evaluation rather than silent tenant-data training.

#### Scenario: Owner rates explanation Wrong
- **WHEN** the rating is submitted
- **THEN** the system records scoped evaluation feedback and exposes a correction or ignore path
