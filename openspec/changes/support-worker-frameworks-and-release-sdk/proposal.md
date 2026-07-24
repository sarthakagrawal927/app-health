## Why

App Health already supports Express, Go, and existing OpenTelemetry pipelines,
but most Fleet request runtimes are Cloudflare Workers using Hono or Pages
Functions. Those projects currently lack the same few-line, privacy-safe
installation path, and the verified JavaScript package is not installable from
the public npm registry because publisher authentication is unavailable.

## What Changes

- Add a Hono middleware adapter that records only the matched route template,
  method, status, duration, timestamp, and optional release after the response.
- Add a Cloudflare Pages Function wrapper that uses an explicitly supplied
  route template and preserves the handler response and error behavior.
- Extend the ingest runtime contract and dashboard copy to distinguish
  Cloudflare Worker traffic from Node.js traffic.
- Ensure Worker adapters keep asynchronous delivery alive with the platform's
  `waitUntil` hook without delaying application responses.
- Publish a verified JavaScript SDK tarball as a public GitHub Release when npm
  authentication remains unavailable, with immutable install instructions.
- Integrate the released adapter into one Fleet Hono Worker as a consumer proof,
  leaving its ingest credential as deployment configuration rather than source.

## Capabilities

### New Capabilities

- `worker-framework-sdk`: Hono and Pages Functions adapters with Cloudflare
  lifecycle, response-preservation, privacy, and consumer-proof requirements.

### Modified Capabilities

- `endpoint-ingestion`: Accept and report Cloudflare Worker as an official SDK
  runtime.
- `endpoint-dashboard`: Show Worker-specific connection state and setup
  guidance.
- `sdk-distribution`: Provide a public, immutable GitHub Release fallback when
  npm publication is externally blocked.

## Impact

The Node SDK gains optional Hono and Pages exports and an optional Hono peer
dependency. Shared contracts, Worker validation, installation state, dashboard
copy, package verification, release documentation, and one Fleet Hono consumer
are affected. No new captured data fields, production storage systems, owner
permissions, or paid Cloudflare services are introduced.
