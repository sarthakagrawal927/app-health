import { describe, expect, it } from 'vitest';
import { createAppHealthClient, type LogBatchV1 } from '../src/index.js';
import { buildLogEventV1, deriveLogsEndpoint } from '../src/log.js';
import { validateLogBatch } from '../../contracts/src/index.js';
import { createFetchController } from './helpers.js';

const ctx = { now: () => 1_725_000_000_000, uuid: () => '11111111-2222-4333-a444-555555555555' };

function client(controller = createFetchController(), extra: Record<string, unknown> = {}) {
  return createAppHealthClient({
    key: 'ahk_test',
    environment: 'production',
    endpoint: 'http://localhost:8787/v1/ingest',
    fetch: controller.fetch,
    disableTimer: true,
    ...extra,
  });
}

describe('buildLogEventV1', () => {
  it('keeps valid input, defaults level and props, bounds text', () => {
    const entry = buildLogEventV1(
      'signup',
      {
        title: '  a@b.co ',
        description: 'x'.repeat(2500),
        icon: '🔔',
        props: {
          plan: 'free',
          seats: 2,
          trial: true,
          ref: null,
          skip: undefined,
          long: 'y'.repeat(600),
        },
      },
      ctx,
    );
    expect(entry).toMatchObject({ event: 'signup', level: 'info', title: 'a@b.co', icon: '🔔' });
    expect(entry?.description).toHaveLength(2000);
    expect(entry?.props).toEqual({
      plan: 'free',
      seats: 2,
      trial: true,
      ref: null,
      long: expect.any(String),
    });
    expect(String(entry?.props.long)).toHaveLength(500);
    expect(entry?.timestamp).toBe(ctx.now());
    expect(validateLogBatch({ schema_version: 'v1', logs: [entry] }).ok).toBe(true);
  });

  it('accepts explicit levels and timestamps, and omits empty text', () => {
    const entry = buildLogEventV1('a.b:c-d', { level: 'error', title: '   ', timestamp: 42 }, ctx);
    expect(entry).toEqual({
      log_id: ctx.uuid(),
      timestamp: 42,
      event: 'a.b:c-d',
      level: 'error',
      props: {},
    });
    expect(buildLogEventV1('x', { timestamp: -1 }, ctx)?.timestamp).toBe(ctx.now());
    expect(buildLogEventV1('x', { timestamp: 1.5 }, ctx)?.timestamp).toBe(ctx.now());
  });

  it('drops input that cannot satisfy the contract', () => {
    const bad: [unknown, Record<string, unknown>][] = [
      ['Bad Name', {}],
      [42, {}],
      ['x', { level: 'fatal' }],
      ['x', { props: [] }],
      ['x', { props: { nested: {} } }],
      ['x', { props: { '': 1 } }],
      ['x', { props: { k: Number.NaN } }],
      ['x', { props: Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`k${i}`, i])) }],
    ];
    for (const [event, input] of bad) {
      expect(
        buildLogEventV1(event, input as never, ctx),
        JSON.stringify([event, input]).slice(0, 60),
      ).toBeNull();
    }
  });
});

describe('deriveLogsEndpoint', () => {
  it('swaps /v1/ingest for /v1/logs and falls back to /v1/logs on the same origin', () => {
    expect(deriveLogsEndpoint('https://ingest.sassmaker.com/v1/ingest')).toBe(
      'https://ingest.sassmaker.com/v1/logs',
    );
    expect(deriveLogsEndpoint('http://localhost:8787/custom')).toBe(
      'http://localhost:8787/v1/logs',
    );
  });
});

describe('client.log()', () => {
  it('sends logs to the logs endpoint as a V1 batch with the client environment', async () => {
    const controller = createFetchController();
    const c = client(controller);
    c.log('signup', { title: 'a@b.co', props: { plan: 'free' } });
    c.log('payment.failed', { level: 'error', description: 'declined' });
    await c.flush();
    expect(controller.requests).toHaveLength(1);
    expect(controller.requests[0].url).toBe('http://localhost:8787/v1/logs');
    expect(controller.requests[0].headers.authorization).toBe('Bearer ahk_test');
    const batch = JSON.parse(controller.requests[0].body) as LogBatchV1;
    expect(batch.schema_version).toBe('v1');
    expect(batch.environment).toBe('production');
    expect(batch.logs.map((entry) => entry.event)).toEqual(['signup', 'payment.failed']);
    expect(validateLogBatch(batch).ok).toBe(true);
    expect(c.diagnostics()).toMatchObject({ sentBatches: 1, sentEvents: 2, queued: 0 });
  });

  it('keeps endpoint events and logs on separate requests within one flush', async () => {
    const controller = createFetchController();
    const c = client(controller);
    c.record({ method: 'GET', route: '/health', status_code: 200, duration_ms: 1 });
    c.log('signup');
    await c.flush();
    expect(controller.requests.map((request) => request.url)).toEqual([
      'http://localhost:8787/v1/ingest',
      'http://localhost:8787/v1/logs',
    ]);
  });

  it('honours an explicit logsEndpoint and rejects a malformed one', async () => {
    const controller = createFetchController();
    const c = client(controller, { logsEndpoint: 'https://logs.example.test/in' });
    c.log('signup');
    await c.flush();
    expect(controller.requests[0].url).toBe('https://logs.example.test/in');
    expect(() => client(controller, { logsEndpoint: 'ftp://nope' })).toThrow(/logsEndpoint/);
  });

  it('drops invalid logs, enforces the shared queue bound, and flushes at the batch size', async () => {
    const controller = createFetchController();
    const c = client(controller, { maxQueueSize: 3, maxBatchSize: 2 });
    c.log('Bad Name');
    expect(c.diagnostics().droppedInvalid).toBe(1);
    c.log('one');
    c.log('two'); // reaches logBatchSize -> background flush starts
    c.log('three');
    c.log('four');
    await c.flush();
    const d = c.diagnostics();
    expect(d.droppedOverflow + d.sentEvents).toBe(4);
    expect(d.sentBatches).toBeGreaterThanOrEqual(1);
  });

  it('drains logs after close and ignores logs once closed', async () => {
    const controller = createFetchController();
    const c = client(controller);
    c.log('before.close');
    await c.close();
    c.log('after.close');
    await c.flush();
    expect(controller.requests).toHaveLength(1);
    expect((JSON.parse(controller.requests[0].body) as LogBatchV1).logs[0].event).toBe(
      'before.close',
    );
  });

  it('records delivery failures for log batches without throwing', async () => {
    const controller = createFetchController(400);
    const c = client(controller, { maxRetries: 0 });
    c.log('signup');
    await c.flush();
    expect(c.diagnostics()).toMatchObject({ failedBatches: 1, droppedDelivery: 1 });
  });
});
