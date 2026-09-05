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
      logs: [LogEventV1.parse(log())],
    });
    expect(response.logs[0].level).toBe('info');
  });
});
