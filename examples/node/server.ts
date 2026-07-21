// Runnable Express example for @saas-maker/app-health.
//
// Usage:
//   pnpm --filter @app-health/example-node start
//
// Configuration (no env file or key is committed):
//   - Pass the ingest key programmatically via APP_HEALTH_KEY (process env
//     reference) or via the command line: APP_HEALTH_KEY=ahk_xxx pnpm start
//   - Override the ingest URL with APP_HEALTH_ENDPOINT
//     (default: http://localhost:8787/v1/ingest)
//   - Override the listen port with PORT (default: 3000)
//
// The example never reads or commits any secret file. The key is read from
// the process environment at runtime only. If no key is provided, the example
// prints a clear instruction and exits without starting the server.
//
// Privacy: only method, normalized route template, status, duration,
// timestamp, and optional release are captured. No headers, cookies, query
// values, route parameter values, bodies, identity, logs, stacks, or spans.

import express from 'express';
import { createAppHealthClient } from '@saas-maker/app-health';
import { expressMiddleware } from '@saas-maker/app-health/express';

const KEY = process.env.APP_HEALTH_KEY;
const ENDPOINT = process.env.APP_HEALTH_ENDPOINT ?? 'http://localhost:8787/v1/ingest';
const PORT = Number(process.env.PORT ?? 3000);
const RELEASE = process.env.APP_HEALTH_RELEASE ?? 'example-1.0.0';

if (!KEY || KEY.length === 0) {
  console.error(
    'app-health example: set APP_HEALTH_KEY to your ingest key before starting.\n' +
      'Example: APP_HEALTH_KEY=ahk_xxx pnpm --filter @app-health/example-node start',
  );
  process.exit(1);
}

const client = createAppHealthClient({
  key: KEY,
  endpoint: ENDPOINT,
  release: RELEASE,
});

const app = express();
app.use(express.json());
app.use(expressMiddleware({ client }));

app.get('/health', (_req, res) => res.status(200).json({ ok: true }));
app.get('/users/:id', (req, res) => {
  if (req.params.id === 'missing') return res.status(404).json({ error: 'not found' });
  res.status(200).json({ id: req.params.id });
});
app.post('/orders', (req, res) => res.status(201).json({ ok: true, received: !!req.body }));
app.get('/orders/:id/items/:itemId', (req, res) =>
  res.status(200).json({ id: req.params.id, itemId: req.params.itemId }),
);

const server = app.listen(PORT, () => {
  console.log(`app-health example listening on http://localhost:${PORT}`);
  console.log(`ingest endpoint: ${ENDPOINT}`);
  console.log('try: curl http://localhost:%d/health', PORT);
  console.log('     curl http://localhost:%d/users/123', PORT);
  console.log(
    '     curl -X POST http://localhost:%d/orders -H "content-type: application/json" -d \'{}\'',
    PORT,
  );
});

async function shutdown(signal: string): Promise<void> {
  console.log(`app-health example: received ${signal}, flushing and exiting.`);
  server.close();
  await client.close();
  console.log('app-health example: diagnostics=', client.diagnostics());
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
