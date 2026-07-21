## ADDED Requirements

### Requirement: Retry-stable Node batch identity
The Node SDK SHALL assign one UUID batch identifier before delivery and reuse it
for every retry of that serialized batch.

#### Scenario: Delivery retries
- **WHEN** one Node batch is attempted multiple times
- **THEN** every attempt carries the same batch ID
