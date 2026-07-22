## Why

The App Health Go SDK currently provides an Echo v4 adapter, but current
Polaris uses Echo v5. Duplicating the adapter inside every Echo v5 consumer
would make privacy, status handling, and lifecycle behavior drift.

## What Changes

- Add a first-class `packages/go/echo/v5` adapter to the App Health module.
- Keep batching, retries, privacy validation, diagnostics, and shutdown in the
  shared client.
- Add Echo v5 route/status/error/panic/privacy tests and a local example proof.
- Add explicit enable, project identity, environment gating, and a small
  framework installer so consumers need only one setup call and one cleanup.

## Non-Goals

- No production deployment in this change.
- No Echo v4 API changes.
- No request content, identity, logs, traces, or arbitrary metadata capture.
