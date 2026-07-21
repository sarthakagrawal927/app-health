## ADDED Requirements

### Requirement: Node package is independently installable
The release SHALL produce a versioned `@saas-maker/app-health` package whose
root client and Express subpath can be imported from built artifacts without
workspace resolution or a separately published contracts package.

#### Scenario: Consumer installs the packed Node artifact
- **WHEN** an external fixture installs the generated package tarball
- **THEN** it imports the core client and Express middleware from documented paths and records a request

### Requirement: Go module uses the real repository path
The Go SDK SHALL declare
`github.com/sarthakagrawal927/app-health/packages/go` as its module path and
SHALL expose the Echo adapter beneath that module.

#### Scenario: Consumer compiles against the module
- **WHEN** a fixture imports the core module and its `/echo` package
- **THEN** `go test` resolves both imports without a placeholder module path

### Requirement: Releases are explicit and verifiable
Publication SHALL run only from a clean, synchronized, green commit and SHALL
verify package contents and consumer behavior before creating a registry
version or Go module tag.

#### Scenario: npm identity is unavailable
- **WHEN** the release environment cannot authenticate to the approved npm scope
- **THEN** it leaves a verified package artifact without publishing or exposing credentials

### Requirement: Distribution preserves the privacy contract
Published artifacts MUST NOT add capture of headers, cookies, query values,
route parameter values, request or response bodies, identity, logs, stacks, or
spans.

#### Scenario: Framework request carries sensitive content
- **WHEN** Express or Echo handles a request with private headers, parameters, query values, and body content
- **THEN** the emitted package payload contains only the approved endpoint summary fields
