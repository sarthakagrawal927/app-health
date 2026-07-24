## MODIFIED Requirements

### Requirement: Versioned authenticated batches
Ingest SHALL verify the environment-scoped key against its D1 SHA-256 verifier,
validate the schema version and bounded event fields, enforce a bounded request
body before JSON parsing, reject unknown unsafe content, and accept valid Node,
Cloudflare Worker, and Go batches under the same contract.

#### Scenario: Valid mixed-runtime contract fixtures
- **WHEN** canonical Node, Cloudflare Worker, and Go fixtures carry equivalent endpoint summaries
- **THEN** ingest validates all three into the same internal event shape
