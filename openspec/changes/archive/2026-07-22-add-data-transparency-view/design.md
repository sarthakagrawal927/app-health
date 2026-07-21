## Context

The ingest contract accepts bounded endpoint summaries, aggregates every
request into Analytics Engine, and retains only normalized endpoint inventory
plus 24-hour 4xx/5xx details in D1. The dashboard currently renders the
aggregates but gives no direct visibility into the retained failure rows or the
storage policy behind them.

## Goals / Non-Goals

**Goals:**

- Make the complete retained telemetry shape inspectable by the owner.
- Show recent 4xx/5xx details without weakening the current privacy boundary.
- Explain, in-product, the difference between accepted, aggregated, retained,
  and never-collected data.
- Keep reads bounded and avoid polling failure details when the view is closed.

**Non-Goals:**

- Raw success-event storage, request/response payloads, logs, traces, stacks,
  user identity, query values, headers, or concrete route parameters.
- Search, alerts, incident management, or a general log explorer.
- Changing SDK delivery or ingest storage behavior.

## Decisions

### Use a dedicated owner-only recent-failures query

Add `GET /v1/failures` with required app and environment scope and a bounded
limit. The response carries every retained field for each returned failure and
the fixed 24-hour retention policy. This is preferable to embedding failures in
the endpoint response because the dashboard can avoid D1 reads until the owner
opens the transparency view.

### Treat transparency as a peer dashboard view

The product shell gets two familiar views: `Endpoints` for current operational
health and `Data received` for provenance and retained detail. The second view
loads on demand and refreshes explicitly, avoiding decorative dashboard
widgets and making the trust question the page's primary task.

### Show policy beside evidence

The transparency view combines a recent-failure table with a field ledger:
accepted fields, their destination and retention, plus a plainly worded list of
fields never collected. This prevents an empty failure table from being
misread as proof of privacy while still giving concrete evidence when failures
exist.

### Keep the query storage-neutral

V0 reads the existing `failure_events` table and adds no index or table. The
24-hour cleanup already bounds cardinality; the API limit bounds response size.
If fleet volume later makes this read materially expensive, a composite index
can be justified from measured query cost.

## Risks / Trade-offs

- **A bounded list is not an export of every retained failure** → Label it
  `latest failures`, return the applied limit and total returned count, and do
  not claim it is a complete log archive.
- **An owner may infer that successful raw events are available** → State
  prominently that 2xx/3xx requests are aggregated immediately and have no
  individual rows.
- **Failure routes may still reveal concrete values if an SDK is misconfigured**
  → Continue server-side route normalization and display only the stored route
  template; do not add a raw-path fallback.
- **Frequent D1 reads add cost** → Fetch only when the view opens or the owner
  presses refresh; do not include it in the 10-second endpoint polling loop.

## Migration Plan

No schema migration is introduced by this change. Deploy the Worker and web
asset together after production migration `0003_batch_dedupe.sql` is confirmed
applied. Rollback is the previous Worker version; retained rows remain bounded
and compatible.

## Open Questions

None for V0. Export and pagination remain explicitly deferred until real
failure volume proves they are needed.
