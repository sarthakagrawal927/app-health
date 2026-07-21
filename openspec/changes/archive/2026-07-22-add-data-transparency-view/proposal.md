## Why

App Health asks an operator to trust a background SDK with production request
metadata, but the current dashboard only shows computed endpoint metrics. The
operator needs a first-party, inspectable account of what arrived, what remains
queryable, how long it is retained, and what is deliberately never collected.

## What Changes

- Add an owner-authenticated API for recent retained 4xx/5xx failure details.
- Add a dashboard transparency surface that shows aggregate endpoint data,
  recent failures, retention windows, and the complete accepted field set.
- Explicitly distinguish aggregate-only successful requests from short-lived
  failure details and from fields that App Health rejects or discards.
- Preserve current privacy and storage bounds: no keys, headers, cookies,
  bodies, query values, route parameter values, user identity, logs, or stacks.

## Capabilities

### New Capabilities

- `data-transparency`: Owner-visible retained telemetry, recent failure details,
  field provenance, retention, and never-collected guarantees.

### Modified Capabilities

None.

## Impact

The shared contracts, Worker repository/service/API, D1 and in-memory adapters,
dashboard data loading and presentation, and their tests are affected. The
change is read-only over the existing `failure_events` table and adds no
production dependency or new telemetry field. Production availability requires
the already-reviewed additive D1 migration before the Worker version is
deployed.
