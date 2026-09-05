import { describe, expect, it } from 'vitest';
import {
  LOG_LEVELS,
  LogEventV1,
  LogQueryRequestV1,
  LogQueryResponseV1,
  LOG_RETENTION_DAYS,
  MAX_LOG_BATCH,
  MAX_LOG_PROPS,
  logLevelAtLeast,
  validateLogBatch,
  validateBrowserLogBatch,
  BrowserLogBatchV1,
  CreatePublicLogKeyRequestV1,
  PublicLogKeyV1,
  WebOrigin,
  defaultLogRoutes,
  logMatchesRoute,
  routeLogs,
  LogRoutesV1,
  type LogRouteV1,
  type StoredLogV1,
} from '../src/index.js';

const LOG_ID = '11111111-2222-4333-a444-555555555555';

function log(overrides: Record<string, unknown> = {}) {
  return { log_id: LOG_ID, timestamp: 1_725_000_000_000, event: 'signup', ...overrides };
}

describe('log batch validation', () => {
  it('accepts a minimal batch and applies level and props defaults', () => {
    const result = validateLogBatch({ schema_version: 'v1', logs: [log()] });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.batch.logs[0]).toMatchObject({ level: 'info', props: {} });
  });

  it('accepts every level, an environment, text fields, and scalar props', () => {
    for (const level of LOG_LEVELS) {
      const result = validateLogBatch({
        schema_version: 'v1',
        environment: 'production',
        logs: [
          log({
            level,
            title: 'a@b.co',
            description: 'via google',
            icon: '🔔',
            props: { plan: 'free', seats: 2, trial: true, ref: null },
          }),
        ],
      });
      expect(result.ok).toBe(true);
    }
  });

  it('rejects unknown fields, bad names, nested props, and oversized batches', () => {
    const bad: unknown[] = [
      { schema_version: 'v1', logs: [] },
      { schema_version: 'v2', logs: [log()] },
      { schema_version: 'v1', logs: [log()], extra: true },
      { schema_version: 'v1', logs: [log({ event: 'Has Space' })] },
      { schema_version: 'v1', logs: [log({ event: '-leading' })] },
      { schema_version: 'v1', logs: [log({ level: 'fatal' })] },
      { schema_version: 'v1', logs: [log({ props: { nested: {} } })] },
      { schema_version: 'v1', logs: [log({ props: { list: [1] } })] },
      { schema_version: 'v1', logs: [log({ title: '' })] },
      { schema_version: 'v1', logs: [log({ log_id: 'nope' })] },
      { schema_version: 'v1', logs: [log({ user: { email: 'x' } })] },
      {
        schema_version: 'v1',
        logs: [
          log({
            props: Object.fromEntries(
              Array.from({ length: MAX_LOG_PROPS + 1 }, (_, i) => [`k${i}`, i]),
            ),
          }),
        ],
      },
      { schema_version: 'v1', logs: Array.from({ length: MAX_LOG_BATCH + 1 }, () => log()) },
      null,
    ];
    for (const body of bad) {
      const result = validateLogBatch(body);
      expect(result.ok, JSON.stringify(body)?.slice(0, 80)).toBe(false);
      if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('reports the failing path in each error', () => {
    const result = validateLogBatch({ schema_version: 'v1', logs: [log({ event: 'BAD' })] });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.errors[0]).toMatch(/^logs\.0\.event:/);
    const root = validateLogBatch(42);
    if (root.ok) throw new Error('unreachable');
    expect(root.errors[0]).toMatch(/^\$:/);
  });
});

describe('log levels', () => {
  it('orders debug < info < warn < error', () => {
    expect(logLevelAtLeast('debug', 'debug')).toBe(true);
    expect(logLevelAtLeast('info', 'warn')).toBe(false);
    expect(logLevelAtLeast('error', 'warn')).toBe(true);
    expect(logLevelAtLeast('warn', 'error')).toBe(false);
  });
});

describe('log query contracts', () => {
  it('defaults level, limit, and rejects bad filters', () => {
    const parsed = LogQueryRequestV1.parse({ app_id: 'a', environment_id: 'e' });
    expect(parsed).toMatchObject({ level: 'debug', limit: 100 });
    expect(
      LogQueryRequestV1.safeParse({ app_id: 'a', environment_id: 'e', limit: 501 }).success,
    ).toBe(false);
    expect(
      LogQueryRequestV1.safeParse({ app_id: 'a', environment_id: 'e', event: 'Bad' }).success,
    ).toBe(false);
    expect(
      LogQueryRequestV1.safeParse({ app_id: 'a', environment_id: 'e', level: 'loud' }).success,
    ).toBe(false);
  });

  it('validates a response envelope', () => {
    const response = LogQueryResponseV1.parse({
      refreshed_at: 1,
      level: 'info',
      retention_days: LOG_RETENTION_DAYS,
      limit: 100,
      logs: [{ ...LogEventV1.parse(log()), source: 'server' }],
    });
    expect(response.logs[0].level).toBe('info');
    expect(
      LogQueryRequestV1.parse({ app_id: 'a', environment_id: 'e', source: 'browser' }).source,
    ).toBe('browser');
    expect(
      LogQueryRequestV1.safeParse({ app_id: 'a', environment_id: 'e', source: 'cli' }).success,
    ).toBe(false);
  });
});

describe('browser batches and public keys', () => {
  it('requires a prefixed public key in the body and rejects server-shaped batches', () => {
    const ok = validateBrowserLogBatch({
      schema_version: 'v1',
      public_key: 'ahk_pub_abc',
      logs: [log()],
    });
    expect(ok.ok).toBe(true);
    expect(validateBrowserLogBatch({ schema_version: 'v1', logs: [log()] }).ok).toBe(false);
    expect(
      validateBrowserLogBatch({ schema_version: 'v1', public_key: 'ahk_secret', logs: [log()] }).ok,
    ).toBe(false);
    expect(
      BrowserLogBatchV1.safeParse({
        schema_version: 'v1',
        public_key: 'ahk_pub_x',
        logs: [log()],
        extra: 1,
      }).success,
    ).toBe(false);
    const bad = validateBrowserLogBatch(null);
    if (bad.ok) throw new Error('unreachable');
    expect(bad.errors[0]).toMatch(/^\$:/);
  });

  it('accepts origins without paths and bounds the allowlist', () => {
    for (const origin of [
      'https://karte.app',
      'http://localhost:5173',
      'https://a-b.example.co.uk:8443',
    ]) {
      expect(WebOrigin.safeParse(origin).success, origin).toBe(true);
    }
    for (const origin of [
      'https://karte.app/',
      'karte.app',
      'ftp://x.y',
      'https://x.y/path',
      '*',
    ]) {
      expect(WebOrigin.safeParse(origin).success, origin).toBe(false);
    }
    expect(
      CreatePublicLogKeyRequestV1.safeParse({
        app_id: 'a',
        environment_id: 'e',
        allowed_origins: [],
      }).success,
    ).toBe(false);
    expect(
      CreatePublicLogKeyRequestV1.safeParse({
        app_id: 'a',
        environment_id: 'e',
        allowed_origins: Array.from({ length: 21 }, (_, i) => `https://h${i}.example`),
      }).success,
    ).toBe(false);
    const record = PublicLogKeyV1.parse({
      id: 'pk-1',
      app_id: 'a',
      environment_id: 'e',
      allowed_origins: ['https://karte.app'],
      created_at: 1,
      revoked_at: null,
    });
    expect(record.revoked_at).toBeNull();
  });
});

describe('log routing', () => {
  const stored = (overrides: Partial<StoredLogV1> = {}): StoredLogV1 => ({
    ...LogEventV1.parse(log()),
    source: 'server',
    ...overrides,
  });

  it('default routes store everything, alert server logs at the threshold, browser logs at error', () => {
    const routes = defaultLogRoutes('warn');
    expect(LogRoutesV1.parse(routes)).toEqual(routes);
    const grouped = routeLogs(
      [
        stored({ log_id: '11111111-2222-4333-a444-000000000001', level: 'info' }),
        stored({ log_id: '11111111-2222-4333-a444-000000000002', level: 'warn' }),
        stored({
          log_id: '11111111-2222-4333-a444-000000000003',
          level: 'warn',
          source: 'browser',
        }),
        stored({
          log_id: '11111111-2222-4333-a444-000000000004',
          level: 'error',
          source: 'browser',
        }),
      ],
      routes,
    );
    expect(grouped.store?.length).toBe(4);
    expect(grouped.slack?.map((entry) => entry.log_id.slice(-1))).toEqual(['2', '4']);
    expect(defaultLogRoutes()[1].match.min_level).toBe('info');
  });

  it('matches on event name and unions sinks across rules; empty sinks are absent', () => {
    const routes: LogRouteV1[] = [
      { match: { event: 'payment.failed' }, sinks: ['slack'] },
      { match: { min_level: 'debug' }, sinks: ['store'] },
    ];
    const payment = stored({ event: 'payment.failed' });
    expect(logMatchesRoute(payment, routes[0])).toBe(true);
    expect(logMatchesRoute(stored(), routes[0])).toBe(false);
    const grouped = routeLogs([payment], routes);
    expect(grouped.slack).toHaveLength(1);
    expect(grouped.store).toHaveLength(1);
    expect(routeLogs([stored()], [{ match: { source: 'browser' }, sinks: ['slack'] }])).toEqual({});
    expect(LogRoutesV1.safeParse([]).success).toBe(false);
    expect(LogRoutesV1.safeParse([{ match: {}, sinks: ['email'] }]).success).toBe(false);
    expect(LogRoutesV1.safeParse([{ match: { bogus: 1 }, sinks: ['store'] }]).success).toBe(false);
  });
});
