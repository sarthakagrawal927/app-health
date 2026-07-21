import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createAppHealthClient } from '../src/index.js';
import { expressMiddleware } from '../src/express.js';
import { createFetchController } from './helpers.js';

// Prove that serialized batches never contain headers, cookies, query values,
// route parameter values, request or response bodies, user identity, logs,
// stacks, or spans. Only the V1 endpoint-summary fields are ever sent.

const ALLOWED_EVENT_KEYS = [
  'duration_ms',
  'event_id',
  'method',
  'release',
  'route',
  'status_code',
  'timestamp',
].sort();
const ALLOWED_BATCH_KEYS = ['events', 'release', 'runtime', 'schema_version'].sort();

const FORBIDDEN_FRAGMENTS = [
  'authorization',
  'cookie',
  'token',
  'secret',
  'password',
  'api-key',
  'apikey',
  'session',
  'user-id',
  'userid',
  'trace',
  'span',
  'stack',
  'log',
  'body',
  'query',
  'param',
  'Bearer',
];

describe('privacy: serialized batches exclude all request content', () => {
  it('only carries V1 endpoint-summary fields', async () => {
    const controller = createFetchController();
    const client = createAppHealthClient({
      key: 'ahk_test',
      endpoint: 'http://localhost:8787/v1/ingest',
      fetch: controller.fetch,
      disableTimer: true,
      release: 'v1.0.0',
    });
    const app = express();
    app.use(express.json());
    app.use(expressMiddleware({ client }));
    app.post('/orders', (_req, res) => res.status(201).json({ ok: true }));

    await request(app)
      .post('/orders')
      .set('authorization', 'Bearer super-secret-token')
      .set('cookie', 'session=abc123; user-id=42')
      .query({ token: 'querysecret', debug: '1' })
      .send({ password: 'hunter2', user: { email: 'a@b.com' } });

    await client.flush();
    expect(controller.requests).toHaveLength(1);
    const batch = JSON.parse(controller.requests[0].body);
    expect(Object.keys(batch).sort()).toEqual(ALLOWED_BATCH_KEYS);
    expect(batch.schema_version).toBe('v1');
    expect(batch.runtime).toBe('node');
    for (const event of batch.events) {
      const keys = Object.keys(event).sort();
      for (const k of keys) expect(ALLOWED_EVENT_KEYS).toContain(k);
      // This client sets a release, so the release key must be present.
      expect(keys).toContain('release');
    }
    const serialized = controller.requests[0].body;
    for (const fragment of FORBIDDEN_FRAGMENTS) {
      expect(serialized.toLowerCase()).not.toContain(fragment.toLowerCase());
    }
  });

  it('never references req.headers, req.query, req.params, or req.body in source', async () => {
    // Source-level privacy guard: the middleware module must not read
    // sensitive request properties. This protects against future regressions.
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../src/middleware.ts', import.meta.url), 'utf8');
    // `req.route.path` and `req.baseUrl` and `req.path`/`req.url` are allowed.
    expect(src).not.toMatch(/req\.headers/);
    expect(src).not.toMatch(/req\.cookies/);
    expect(src).not.toMatch(/req\.query/);
    expect(src).not.toMatch(/req\.params/);
    expect(src).not.toMatch(/req\.body/);
    expect(src).not.toMatch(/res\.body/);
  });

  it('the client only accepts endpoint-summary input fields', async () => {
    const controller = createFetchController();
    const client = createAppHealthClient({
      key: 'ahk_test',
      endpoint: 'http://localhost:8787/v1/ingest',
      fetch: controller.fetch,
      disableTimer: true,
    });
    // Extra fields on the input are ignored (not serialized) because record()
    // only reads the documented EventInput keys.
    client.record({
      method: 'GET',
      route: '/health',
      status_code: 200,
      duration_ms: 1,
      // @ts-expect-error -- intentionally passing an extra forbidden-ish field
      headers: { authorization: 'Bearer x' },
      body: { secret: true },
      user: { id: 42 },
    });
    await client.flush();
    const serialized = controller.requests[0].body;
    expect(serialized).not.toContain('authorization');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('"user"');
    const event = JSON.parse(serialized).events[0];
    const keys = Object.keys(event).sort();
    // Release is optional; every present key must be in the allowed set.
    for (const k of keys) expect(ALLOWED_EVENT_KEYS).toContain(k);
    expect(keys).toContain('method');
    expect(keys).toContain('route');
    expect(keys).toContain('status_code');
    expect(keys).toContain('duration_ms');
    expect(keys).toContain('timestamp');
    expect(keys).toContain('event_id');
  });
});
