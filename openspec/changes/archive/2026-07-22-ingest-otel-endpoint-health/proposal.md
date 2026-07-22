## Why

Teams that already operate an OpenTelemetry pipeline should not have to install
duplicate App Health middleware to receive the same endpoint-health insights.
App Health can meet those teams at the standard OTLP boundary while preserving
its narrow, aggregate-only privacy contract.

## What Changes

- Add an authenticated OTLP/HTTP trace-ingest path that accepts standard
  OpenTelemetry export requests and projects eligible HTTP server spans into
  the existing endpoint summary pipeline.
- Require a trusted low-cardinality route and allowlist only method, route,
  status, duration, timestamp, and optional service version; ignore all other
  span, resource, event, link, baggage, URL, header, body, identity, log, and
  stack data.
- Accept current stable HTTP semantic attributes and the prior widely deployed
  attribute names needed for existing collectors.
- Mark all OTel trace-derived endpoint metrics as upstream-sampled because an
  export payload cannot prove the completeness of the source trace stream.
- Add an Existing OpenTelemetry setup path with a standard Collector OTLP/HTTP
  exporter snippet, one-time ingest-key handling, and installation verification.
- Keep the Node and Go SDK paths as the zero-OTel fallback; no SDK or Collector
  plugin is required for an existing OTel user.

## Capabilities

### New Capabilities

- `otel-endpoint-ingestion`: Authenticated OTLP/HTTP intake, privacy-bounded
  span projection, semantic-convention compatibility, and sampling provenance.

### Modified Capabilities

- `endpoint-dashboard`: Add OTel onboarding and disclose upstream sampling
  while preserving the existing endpoint table and one-time-key boundary.
- `project-key-setup`: Treat a verified OTel export as a supported installation
  runtime for the selected app and environment.

## Impact

- Affects Worker routing, request decoding, ingest contracts, aggregate query
  metadata, setup UI, tests, and documentation.
- Adds one production dependency only if required for safe binary protobuf
  decoding; no OpenTelemetry SDK is added to instrumented applications.
- Adds local OTLP compatibility only. Production deployment, DNS, secrets,
  migrations, and live canary work remain separately approved operations.
