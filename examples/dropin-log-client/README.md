# Drop-in log client

`ping.ts` is a zero-dependency sender for App Health application logs. Copy it
into an app, set `APP_HEALTH_INGEST_KEY` (and `APP_HEALTH_ENVIRONMENT`), and
call `ping('signup', { title, props })`. One POST per call to `/v1/logs`; no
batching, no timers, safe on Cloudflare Workers and Node alike.

`ping-web.ts` is the browser counterpart for static sites: it takes a public
log key (`ahk_pub_…`, created in the dashboard's Logs tab and pinned to your
origin) and posts one `text/plain` batch per call, switching to `sendBeacon`
when the page is hiding.

Use the SDK (`appHealth.log()` on servers, `createWebLogger` from
`@saas-maker/app-health/web` in bundled frontends) when the app already
installs the package. Wiring guide and decisions: [docs/logs.md](../../docs/logs.md).
