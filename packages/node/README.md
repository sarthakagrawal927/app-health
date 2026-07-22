# App Health for Node.js

Privacy-first endpoint health telemetry for Node.js 20+ and Express. The SDK
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
