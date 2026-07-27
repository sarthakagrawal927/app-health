## Context

`Dashboard` currently owns the endpoint window, but renders the 15m/1h/24h control only in the endpoint view. `DataReceived` always requests the full 24-hour D1 retention window, so switching tabs can compare different periods without saying so.

The supported periods already exist in the shared contracts. Failure rows contain timestamps and the repository query already accepts a lower-bound timestamp, so no storage or ingest change is required.

## Goals / Non-Goals

**Goals:**

- Make one selected period visible and effective in both dashboard views.
- Filter retained failures on the server using the same allowlisted period.
- Preserve the existing 24-hour retention ceiling, result limit, privacy fields, and on-demand failure loading.
- Keep callers that omit a failure window on the current 24-hour behavior.

**Non-Goals:**

- Changing which HTTP statuses count toward endpoint error rate.
- Adding custom date ranges, persistence, pagination, or longer retention.
- Changing telemetry ingestion or storage schemas.

## Decisions

### Keep the period state in `Dashboard`

`Dashboard` will continue to own one `Window` value and pass it to both the endpoint loader and `DataReceived`. The same segmented control will remain visible when either tab is active.

This is preferred over independent per-tab state because switching tabs should preserve the operator's comparison period and cannot silently compare 15-minute endpoint metrics with 24-hour failures.

### Add an allowlisted `window` query parameter

`GET /v1/failures` will parse `window` through the existing `Window` contract, defaulting to `24h` for backward compatibility. The service will derive the lower bound from `WINDOW_MS[window]`, while D1 continues enforcing the maximum result limit.

This is preferred over accepting arbitrary timestamps because the dashboard needs only three bounded periods and arbitrary values increase validation and query surface.

### Return the resolved window

The failure response will include the resolved `window`. This lets the client render and test the server-applied period without inferring it from request state. The additive field does not invalidate existing clients.

## Risks / Trade-offs

- [Recent periods can contain no retained rows while the 24-hour period contains failures] → Show period-specific empty copy instead of implying no failures exist at all.
- [Changing tabs could trigger unnecessary D1 polling] → Preserve the current on-demand behavior; failures load only while Data received is mounted or explicitly refreshed.
- [Older callers omit `window`] → Keep `24h` as the server default.

## Migration Plan

Deploy the additive API and web client together in the existing Worker. No data migration or resource provisioning is required. Rollback is the previous Worker version; stored data is unchanged.

## Open Questions

None.
