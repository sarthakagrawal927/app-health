## ADDED Requirements

### Requirement: Retry-stable Go batch identity
The Go SDK SHALL assign one UUID batch identifier before delivery and reuse it
for every retry of that serialized batch.

#### Scenario: Delivery retries
- **WHEN** one Go batch is attempted multiple times
- **THEN** every attempt carries the same batch ID
