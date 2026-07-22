## Why

App Health is live, but its SDKs are still monorepo-only source packages and the
Go integration cannot recover Echo route templates automatically. The first
usable distribution should match the frameworks currently in the fleet:
Express for Node.js and Echo for Go.

## What Changes

- Turn the Node SDK into a buildable, packable `@saas-maker/app-health`
  package with a stable core client and Express adapter.
- Change the Go module to the real repository path and add a first-class Echo
  middleware package that records Echo's normalized route template.
- Expose one explicit Echo installation config containing only enablement,
  environment, ingest key, and project name; keep ingest routing, batching,
  retries, redaction, and shutdown mechanics inside the SDK.
- Keep both delivery clients bounded, asynchronous, fail-open, and independent
  from framework request handling.
- Make string privacy automatic by accepting framework route templates only,
  dropping unmatched concrete paths, and rejecting unsafe release tags rather
  than attempting to transmit reversibly masked request data.
- Add package-consumer tests that install or import packed artifacts rather
  than relying only on workspace source resolution.
- Show copy-ready Express and Echo installation snippets in the private App
  Health setup flow.
- Document private-repository Go consumption and the npm authentication gate;
  publish npm only when the configured identity can access the existing
  `@saas-maker` scope.
- Leave Hapi, Fastify, Koa, Gin, Chi, and other adapters for later evidence-led
  additions.

## Capabilities

### New Capabilities

- `sdk-distribution`: Installable package identities, built artifacts,
  consumer verification, and guarded release behavior for Node and Go.

### Modified Capabilities

- `node-endpoint-sdk`: Express becomes the first supported public Node adapter
  on top of the framework-neutral client.
- `go-endpoint-sdk`: Echo becomes the first supported third-party Go router
  with exact route-template capture.
- `endpoint-dashboard`: Production setup presents supported Express and Echo
  installation paths using the live ingest hostname.

## Impact

- Affects Node package metadata/build output, exports, examples, tests, and
  documentation.
- Changes the Go module path and adds Echo as an adapter dependency while
  preserving the standard-library core package.
- Replaces the environment-variable-named Echo convenience function with a
  small explicit app-facing contract.
- Affects the setup UI and production dashboard deployment.
- npm publication is an external release action and remains blocked until npm
  authentication is available; no credential is committed or printed.
- The GitHub repository remains private unless separately authorized, so Go
  consumers need normal private-module GitHub authentication.
