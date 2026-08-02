# App Health for Node.js

Privacy-first endpoint health telemetry for Node.js 20+, Express, Hono Workers,
and Cloudflare Pages Functions. The SDK
records only the HTTP method, framework route template, response status,
duration, timestamp, and optional release. It does not read headers, query
values, route parameters, request or response bodies, cookies, or identities.
Unmatched concrete paths are dropped, and unsafe free-form release strings are
omitted.

## Express

```bash
npm install @saas-maker/app-health
```

```ts
import { createAppHealthClient } from '@saas-maker/app-health';
import { expressMiddleware } from '@saas-maker/app-health/express';

const appHealth = createAppHealthClient({
  key: process.env.APP_HEALTH_INGEST_KEY!,
  environment: process.env.APP_ENV ?? 'production',
  endpoint: 'https://ingest.sassmaker.com/v1/ingest',
  release: process.env.APP_VERSION,
});

app.use(expressMiddleware({ client: appHealth }));
```

The middleware is asynchronous and fail-open. On graceful shutdown, flush the
bounded queue:

```ts
await appHealth.close();
```

Use `appHealth.diagnostics()` to inspect queued, sent, failed, retried, and
dropped event counts locally.

## Hono on Cloudflare Workers

Until npm publisher authentication is restored, install the same verified
package from its immutable public release:

```bash
npm install https://github.com/sass-maker/app-health/releases/download/node-v0.2.1/saas-maker-app-health-0.2.1.tgz
```

```ts
import { createAppHealthClient } from '@saas-maker/app-health';
import { honoMiddleware } from '@saas-maker/app-health/hono';

const appHealth = createAppHealthClient({
  key: env.APP_HEALTH_INGEST_KEY,
  environment: env.APP_ENV ?? 'production',
  endpoint: 'https://ingest.sassmaker.com/v1/ingest',
  runtime: 'worker',
  disableTimer: true,
});

app.use('*', honoMiddleware({ client: appHealth }));
```

The adapter uses Hono's matched route template after routing and registers
delivery with `ExecutionContext.waitUntil`.

## Cloudflare Pages Functions

Pages routing is file-based, so pass a trusted static route template:

```ts
import { withPagesFunctionHealth } from '@saas-maker/app-health/pages';

export const onRequestGet = withPagesFunctionHealth(
  { client: appHealth, route: '/anime/:malId' },
  async () => Response.json({ ok: true }),
);
```

Both Worker adapters accept a lazy `client` resolver that may return `null`.
Use that form when the ingest-key binding is optional; missing configuration
then leaves the application unchanged.
