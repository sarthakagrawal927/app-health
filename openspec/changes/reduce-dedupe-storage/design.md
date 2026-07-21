## Context

SDKs send at most 100 events per request, but the Worker currently inserts one
`seen_events` D1 row for every event. A 50,000-event run therefore creates
50,000 transient rows even though Analytics Engine receives roughly 500
aggregate points for homogeneous traffic.

## Decisions

### Retry-stable batch identity

`EventBatchV1` gains a required UUID `batch_id`. SDKs create it once when a
batch is built; transport retries reuse the serialized batch and identifier.

### One D1 row per batch

The Worker authenticates and validates the complete batch, then atomically
claims `(app_id, environment_id, batch_id)`. A duplicate batch returns all
events as duplicates without writing inventory or Analytics Engine data.

### Additive migration

Create `seen_batches` and its expiry index. Keep `seen_events` in place for a
safe rollout but stop writing it; a later maintenance migration may remove it.
Hourly cleanup deletes up to 10,000 expired batch rows, representing one
million events/hour at the default 100-event batch size.

### Failure detail without request content

Every 4xx/5xx event gets one minimal D1 row containing only its opaque event ID,
route template, method, status, duration, timestamp, and optional release. Rows
expire after 24 hours. Successful and redirect requests never create detail rows;
all statuses still contribute to aggregate counts and fixed latency histograms.

## Safety

Raw request data remains absent from D1. Authentication, route privacy,
aggregate fields, and Analytics Engine point bounds remain unchanged.
