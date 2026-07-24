## MODIFIED Requirements

### Requirement: Node package is independently installable
The release SHALL produce a versioned `@saas-maker/app-health` package whose
root client, Express, Hono, and Pages Functions subpaths can be imported from
built artifacts without workspace resolution or a separately published
contracts package.

#### Scenario: Consumer installs the packed Node artifact
- **WHEN** an external fixture installs the generated package tarball
- **THEN** it imports the core client and every documented adapter from built artifacts and records representative requests

### Requirement: Releases are explicit and verifiable
Publication SHALL run only from a clean, synchronized, green commit and SHALL
verify package contents and consumer behavior before creating a registry
version, immutable public GitHub Release asset, or Go module tag.

#### Scenario: npm identity is unavailable
- **WHEN** the release environment cannot authenticate to the approved npm scope
- **THEN** it publishes the verified tarball as an immutable public GitHub Release asset without exposing credentials or claiming an npm release

#### Scenario: Consumer uses fallback distribution
- **WHEN** a consumer cannot install the package from npm
- **THEN** it can pin the exact versioned GitHub Release tarball URL and import the same verified exports
