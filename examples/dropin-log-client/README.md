# Drop-in log client

`ping.ts` is a zero-dependency sender for App Health application logs. Copy it
into an app, set `APP_HEALTH_INGEST_KEY` (and `APP_HEALTH_ENVIRONMENT`), and
call `ping('signup', { title, props })`. One POST per call to `/v1/logs`; no
batching, no timers, safe on Cloudflare Workers and Node alike.

Use the SDK's `appHealth.log()` instead when the app already runs the batching
client. Wiring guide and decisions: [docs/logs.md](../../docs/logs.md).
