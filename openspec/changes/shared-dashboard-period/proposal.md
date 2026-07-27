## Why

The endpoint and retained-failure views currently use different implicit periods: endpoint metrics default to 15 minutes while retained failures always cover 24 hours. Operators need one visible period selection so the two views describe the same slice of traffic.

## What Changes

- Share the existing 15m, 1h, and 24h period selection across Endpoints and Data received.
- Add an allowlisted failure-query window parameter and filter retained failures server-side to the selected period.
- Show the active period control and period-specific empty/freshness copy on both dashboard views.
- Keep the existing 24-hour maximum retention and bounded result limit.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `endpoint-dashboard`: The selected period applies consistently when switching between endpoint and retained-data views.
- `data-transparency`: Retained-failure reads accept only supported periods and return rows from the selected period within the existing 24-hour retention bound.

## Impact

This changes the web dashboard state and controls, the owner failure-query route, the failure response contract, and their focused tests. It adds no dependency, storage migration, ingest change, or new production resource.
