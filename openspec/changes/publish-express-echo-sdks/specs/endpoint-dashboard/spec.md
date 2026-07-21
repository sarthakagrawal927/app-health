## MODIFIED Requirements

### Requirement: Production SDK snippets use the ingest origin
The setup view SHALL render copy-ready Express and Echo installation snippets
with their public package paths, the configured production ingest origin, and
the one-time key without persisting the raw key in browser storage or analytics.

#### Scenario: Operator creates a production app
- **WHEN** the creation response returns the one-time key
- **THEN** the visible Express and Echo snippets target the configured ingest origin and the key disappears after the one-time setup state is left

#### Scenario: Operator switches framework snippet
- **WHEN** the operator selects Express or Echo
- **THEN** the dashboard shows only the verified install and middleware code for that framework
