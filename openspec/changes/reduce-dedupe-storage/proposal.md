## Why

Per-event D1 deduplication creates one temporary row per request and the hourly
cleanup can fall behind normal production traffic. Storage cost must scale with
SDK batches, not requests.

## What Changes

- Add a stable `batch_id` to Node and Go ingest batches.
- Deduplicate once per batch instead of once per event.
- Store only short-lived batch identifiers in D1 and clean them at a rate sized
  for at least one million events per hour at the default batch size.
- Retain one minimal, parameter-free row for every 4xx/5xx response for 24 hours.
- Preserve aggregate-only Analytics Engine writes and fail-open SDK behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `endpoint-ingestion`: idempotency and bounded storage operate per batch.
- `go-endpoint-sdk`: every delivered batch carries a retry-stable identifier.
- `node-endpoint-sdk`: every delivered batch carries a retry-stable identifier.

## Impact

Shared contracts, Go and Node SDK batch construction, Worker ingest service,
in-memory/D1 repositories, an additive D1 migration, failure retention, and tests are affected.
The HTTP endpoint and authentication mechanism do not change.
