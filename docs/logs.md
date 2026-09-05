# Application logs

Owner-authored events with levels, stored per app and environment, shown in the
dashboard's Logs tab and optionally posted to Slack. This page is the canonical
home for how to wire an app and why the feature is shaped the way it is; the
README carries the one-paragraph summary.

## Wire an app

1. Create the app in the dashboard (or reuse one) and copy its ingest key.
2. Send logs one of two ways:
   - **Node SDK**: `appHealth.log('signup', { title: user.email, props: { plan } })`
     on the existing client. Logs share the queue and flush cycle with endpoint
     events and travel to `/v1/logs`.
   - **Any runtime, zero dependencies**: copy `examples/dropin-log-client/ping.ts`
     into the app and call `ping('signup', { title, props })`. It posts one
     batch per call and is a silent no-op until `APP_HEALTH_INGEST_KEY` is set,
     so it is safe to merge first. Set `APP_HEALTH_ENVIRONMENT` to the
     environment name the product key should route to (default `production`).
3. Name events `noun` or `noun.verb`, lowercase: `signup`, `waitlist.join`,
   `payment.failed`. Put the human identifier in `title`, filterable fields in
   `props`. Never put secrets or tokens in a log.
4. Open the Logs tab and filter by level or event. For Slack, set the
   `LOG_ALERT_WEBHOOK_URL` secret on the Worker; `LOG_ALERT_MIN_LEVEL` (var,
   default `info`) decides what gets posted.

### Hook points in the fleet

| Auth library         | Hook                                                        |
| -------------------- | ----------------------------------------------------------- |
| better-auth          | `databaseHooks.user.create.after`                           |
| Auth.js with adapter | `events.signIn` when `isNewUser`                            |
| Auth.js JWT-only     | select-before-upsert in `callbacks.signIn`, log when absent |
| Plain route handler  | `void ping('waitlist.join', …)` after the write             |

## Decisions

### 2026-09-05 Logs live in App Health, not a separate service

A standalone Worker (`ping`) was prototyped first: one D1 table, a Slack
webhook, a `/feed` page. It duplicated what App Health already had (per-app
ingest keys, D1, an owner-authenticated dashboard, an SDK, a Worker on the
ingest host). Folding it in reuses all of that and honours the fleet rule of
improving existing products rather than adding one.

### 2026-09-05 Logs are an explicit exception to the aggregate-only boundary

App Health's privacy promise is about endpoint telemetry: nothing is derived
from a request beyond method, route, status, duration, timestamp, release.
Logs are different in kind. They exist only when the owner's code calls
`log()`, and they carry exactly what that code passes. The boundary statement
was rewritten to say both things plainly instead of pretending logs are
telemetry.

### 2026-09-05 Same ingest key, separate route

`/v1/logs` authenticates with the product ingest key already in every app, so
adding logs to an app is a code change, not a key-management task. A separate
route keeps the strict `EventBatchV1` validator untouched and lets the two
payloads evolve independently.

### 2026-09-05 Insert first, alert after

The D1 write is awaited before the `202` so history is durable even when Slack
is down. Slack delivery runs in `ctx.waitUntil` so a slow webhook never slows
the sending app. A failed post is logged, not retried; the row is still in the
Logs tab.

### 2026-09-05 Thirty-day retention, hourly pruning

Failures keep 24 hours because they are high-volume and derived. Logs are
low-volume and hand-picked, so a month is enough to answer "what happened last
week" without an unbounded table. The existing hourly cron prunes both.

### 2026-09-05 Drop-in client alongside the SDK

The Node SDK is installed from GitHub release tarballs, so the eight fleet
apps on Cloudflare Workers would each need a release bump to adopt `log()`.
A ~90-line zero-dependency file that speaks `LogBatchV1` lets them start now;
it is the same contract, so switching to the SDK later is a one-line change.
