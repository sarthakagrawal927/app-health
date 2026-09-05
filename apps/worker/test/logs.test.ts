import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../src/index.js';
import { AppHealthService, InMemoryAdapter } from '../src/index.js';
import {
  D1ControlPlane,
  type D1DatabaseLike,
  type D1PreparedStatement,
} from '../src/d1-adapter.js';
import { buildLogAlert, deliverLogAlerts, escapeMrkdwn } from '../src/log-alerts.js';
import {
  SEED_APP_ID,
  SEED_ENV_ID,
  SEED_KEY,
  SEED_ENV_NAME,
  type LogEventV1,
  type LogQueryResponseV1,
} from '@app-health/contracts';

const LOCAL_ENV: Env = { APP_HEALTH_MODE: 'local' };
const NOW = 1_725_000_000_000;

function logId(n: number): string {
  return `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;
}

function log(n: number, overrides: Partial<LogEventV1> = {}): LogEventV1 {
  return {
    log_id: logId(n),
    timestamp: NOW + n,
    event: 'signup',
    level: 'info',
    props: {},
    ...overrides,
  };
}

/** `null` omits the environment field entirely; the default targets the seeded environment. */
function batch(logs: unknown[], environment: string | null = SEED_ENV_NAME) {
  return { schema_version: 'v1', ...(environment === null ? {} : { environment }), logs };
}

async function call(
  method: string,
  path: string,
  env: Env,
  body?: unknown,
  headers?: Record<string, string>,
  ctx?: { waitUntil(promise: Promise<unknown>): void },
): Promise<Response> {
  const init: RequestInit = { method, headers: { 'content-type': 'application/json', ...headers } };
  if (body !== undefined) init.body = JSON.stringify(body);
  return worker.fetch(new Request(new URL(`https://worker.local${path}`), init), env, ctx);
}

const bearer = (key: string) => ({ authorization: `Bearer ${key}` });

describe('log ingest and query routes', () => {
  it('accepts a bearer-keyed log batch and lists it for the owner', async () => {
    const posted = await call(
      'POST',
      '/v1/logs',
      LOCAL_ENV,
      batch([
        log(1, { title: 'a@b.co', props: { plan: 'free', seats: 2 } }),
        log(2, { event: 'payment.failed', level: 'error', description: 'card declined' }),
      ]),
      bearer(SEED_KEY),
    );
    expect(posted.status).toBe(202);
    await expect(posted.json()).resolves.toEqual({ accepted: 2 });

    const listed = await call(
      'GET',
      `/v1/logs?app_id=${SEED_APP_ID}&environment_id=${SEED_ENV_ID}`,
      LOCAL_ENV,
    );
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as LogQueryResponseV1;
    expect(body.retention_days).toBe(30);
    expect(body.logs.map((entry) => entry.event)).toEqual(['payment.failed', 'signup']);
    expect(body.logs[1]).toMatchObject({ title: 'a@b.co', props: { plan: 'free', seats: 2 } });

    const errorsOnly = (await (
      await call(
        'GET',
        `/v1/logs?app_id=${SEED_APP_ID}&environment_id=${SEED_ENV_ID}&level=warn&limit=5`,
        LOCAL_ENV,
      )
    ).json()) as LogQueryResponseV1;
    expect(errorsOnly.logs.map((entry) => entry.event)).toEqual(['payment.failed']);
    expect(errorsOnly.limit).toBe(5);

    const byEvent = (await (
      await call(
        'GET',
        `/v1/logs?app_id=${SEED_APP_ID}&environment_id=${SEED_ENV_ID}&event=signup`,
        LOCAL_ENV,
      )
    ).json()) as LogQueryResponseV1;
    expect(byEvent.logs).toHaveLength(1);
  });

  it('rejects missing keys, invalid batches, wrong methods, and bad queries', async () => {
    expect((await call('POST', '/v1/logs', LOCAL_ENV, batch([log(1)]))).status).toBe(401);
    const invalid = await call(
      'POST',
      '/v1/logs',
      LOCAL_ENV,
      batch([{ ...log(1), event: 'Bad Name' }]),
      bearer(SEED_KEY),
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toMatchObject({
      error: 'invalid log batch',
      details: [expect.stringContaining('logs.0.event')],
    });
    expect((await call('POST', '/v1/logs', LOCAL_ENV, 'not json', bearer(SEED_KEY))).status).toBe(
      400,
    );
    expect((await call('PUT', `/v1/logs?app_id=${SEED_APP_ID}`, LOCAL_ENV)).status).toBe(405);
    expect((await call('GET', '/v1/logs?app_id=only', LOCAL_ENV)).status).toBe(400);
    expect(
      (
        await call(
          'GET',
          `/v1/logs?app_id=${SEED_APP_ID}&environment_id=${SEED_ENV_ID}&limit=9999`,
          LOCAL_ENV,
        )
      ).status,
    ).toBe(400);
  });

  it('rejects oversized log bodies', async () => {
    const huge = batch([log(1, { description: 'x'.repeat(2000) })]);
    const response = await call('POST', '/v1/logs', LOCAL_ENV, huge, {
      ...bearer(SEED_KEY),
      'content-length': String(300 * 1024),
    });
    expect(response.status).toBe(413);
  });

  it('is unavailable outside local mode without production bindings', async () => {
    expect((await call('POST', '/v1/logs', {}, batch([log(1)]), bearer(SEED_KEY))).status).toBe(
      503,
    );
  });
});

describe('log alerts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts alerts through waitUntil when a webhook is configured', async () => {
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const pending: Promise<unknown>[] = [];
    const env: Env = {
      ...LOCAL_ENV,
      LOG_ALERT_WEBHOOK_URL: 'https://hooks.slack.test/abc',
      LOG_ALERT_MIN_LEVEL: 'warn',
    };
    const response = await call(
      'POST',
      '/v1/logs',
      env,
      batch([log(1), log(2, { event: 'boom', level: 'error', title: 'x <y>' })]),
      bearer(SEED_KEY),
      { waitUntil: (promise) => pending.push(promise) },
    );
    expect(response.status).toBe(202);
    expect(pending).toHaveLength(1);
    await Promise.all(pending);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://hooks.slack.test/abc');
    const payload = JSON.parse(String(init.body)) as { text: string };
    expect(payload.text).toBe(`[demo-app/${SEED_ENV_NAME}] boom: x <y>`);
    expect(String(init.body)).toContain('&lt;y&gt;');
  });

  it('awaits alerts inline without a context and tolerates webhook failures', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const env: Env = {
      ...LOCAL_ENV,
      LOG_ALERT_WEBHOOK_URL: 'https://hooks.slack.test/abc',
      LOG_ALERT_MIN_LEVEL: 'not-a-level',
    };
    const response = await call(
      'POST',
      '/v1/logs',
      env,
      batch([log(1), log(2), log(3, { level: 'debug' })]),
      bearer(SEED_KEY),
    );
    expect(response.status).toBe(202);
    // Default threshold is info, so the debug log is skipped and two deliveries were attempted.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it('renders titles, descriptions, props, overflow, and level tags', () => {
    const props = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, i]));
    const rich = buildLogAlert(
      log(1, { level: 'warn', title: 'T', description: 'D & more', props: { ...props, n: null } }),
      { appName: 'karte', environmentName: 'production' },
    ) as { text: string; blocks: Record<string, unknown>[] };
    expect(rich.text).toBe('[karte/production] signup: T');
    expect(rich.blocks).toHaveLength(5);
    expect(JSON.stringify(rich.blocks[0])).toContain('⚠️');
    expect(JSON.stringify(rich.blocks[0])).toContain('`WARN`');
    expect(JSON.stringify(rich.blocks[1])).toContain('D &amp; more');
    expect(JSON.stringify(rich.blocks[3])).toContain('_null_');

    const plain = buildLogAlert(log(2, { icon: '💳' }), { appName: 'a', environmentName: 'b' }) as {
      blocks: Record<string, unknown>[];
    };
    expect(plain.blocks).toHaveLength(2);
    expect(JSON.stringify(plain.blocks[0])).toContain('💳');
    expect(escapeMrkdwn('a & <b>')).toBe('a &amp; &lt;b&gt;');
  });

  it('deliverLogAlerts counts successes and skips below-threshold logs', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 200 }));
    const delivered = await deliverLogAlerts([log(1), log(2, { level: 'error' })], {
      webhookUrl: 'https://hooks.slack.test/x',
      minLevel: 'error',
      appName: 'a',
      environmentName: 'b',
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(delivered).toBe(1);
  });
});

describe('log service and in-memory repository', () => {
  it('dedupes repeated log ids and routes product keys by environment', async () => {
    const adapter = await InMemoryAdapter.create();
    const service = new AppHealthService(adapter.asRepositories());
    const first = await service.ingestLogs(SEED_KEY, batch([log(1), log(1)]), NOW);
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error('unreachable');
    expect(first).toMatchObject({ accepted: 2, app_id: SEED_APP_ID, environment_id: SEED_ENV_ID });
    const listed = await adapter.listLogs(SEED_APP_ID, SEED_ENV_ID, {
      minLevel: 'debug',
      limit: 10,
    });
    expect(listed).toHaveLength(1);

    const created = await service.createApp({ name: 'orders', environment: 'staging' }, NOW);
    const productKey = created.key.key;
    // Product keys route by the batch's environment name, so omitting it is rejected.
    const missingEnv = await service.ingestLogs(productKey, batch([log(5)], null), NOW);
    expect(missingEnv).toMatchObject({ ok: false, status: 400 });
    const routed = await service.ingestLogs(productKey, batch([log(6)], 'staging'), NOW);
    expect(routed.ok).toBe(true);
    const response = await service.queryLogs(
      created.app.id,
      created.environment.id,
      'debug',
      undefined,
      50,
      NOW,
    );
    expect(response.logs.map((entry) => entry.log_id)).toEqual([logId(6)]);
  });

  it('returns an empty response when no log repository is configured', async () => {
    const adapter = await InMemoryAdapter.create();
    const repos = adapter.asRepositories();
    delete repos.logs;
    const service = new AppHealthService(repos);
    const ingested = await service.ingestLogs(SEED_KEY, batch([log(1)]), NOW);
    expect(ingested.ok).toBe(true);
    const listed = await service.queryLogs(SEED_APP_ID, SEED_ENV_ID, 'debug', undefined, 10, NOW);
    expect(listed.logs).toEqual([]);
  });
});

class Statement implements D1PreparedStatement {
  values: unknown[] = [];
  constructor(
    readonly sql: string,
    private readonly db: FakeDatabase,
  ) {}
  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this;
  }
  async first<T>(): Promise<T | null> {
    return null;
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: (this.db.allResults.shift() as T[] | undefined) ?? [] };
  }
  async run() {
    return { success: true, meta: { changes: this.db.changes } };
  }
}

class FakeDatabase implements D1DatabaseLike {
  statements: Statement[] = [];
  allResults: unknown[][] = [];
  changes = 3;
  failBatch = false;
  prepare(sql: string): D1PreparedStatement {
    const statement = new Statement(sql, this);
    this.statements.push(statement);
    return statement;
  }
  async batch(statements: D1PreparedStatement[]) {
    return statements.map(() => ({ success: !this.failBatch, meta: { changes: 1 } }));
  }
}

describe('D1 log storage', () => {
  it('inserts logs with nulls for absent text and JSON props', async () => {
    const db = new FakeDatabase();
    const control = new D1ControlPlane(db);
    await control.recordLogs('app', 'env', []);
    expect(db.statements).toHaveLength(0);
    await control.recordLogs('app', 'env', [log(1, { title: 'hi', props: { a: 1 } })]);
    expect(db.statements[0].sql).toContain('INSERT OR IGNORE INTO log_events');
    expect(db.statements[0].values).toEqual([
      logId(1),
      'app',
      'env',
      NOW + 1,
      'signup',
      'info',
      'hi',
      null,
      null,
      '{"a":1}',
    ]);
    db.failBatch = true;
    await expect(control.recordLogs('app', 'env', [log(2)])).rejects.toThrow(
      'D1 log insert failed',
    );
  });

  it('lists logs with a level range, optional event filter, and rehydrated props', async () => {
    const db = new FakeDatabase();
    db.allResults.push([
      {
        log_id: logId(1),
        timestamp: NOW,
        event: 'signup',
        level: 'warn',
        title: 'a@b.co',
        description: null,
        icon: null,
        props: '{"plan":"free"}',
      },
    ]);
    const control = new D1ControlPlane(db);
    const logs = await control.listLogs('app', 'env', {
      minLevel: 'warn',
      event: 'signup',
      limit: 7,
    });
    expect(logs).toEqual([
      {
        log_id: logId(1),
        timestamp: NOW,
        event: 'signup',
        level: 'warn',
        title: 'a@b.co',
        props: { plan: 'free' },
      },
    ]);
    expect(db.statements[0].sql).toContain('level IN (?, ?)');
    expect(db.statements[0].sql).toContain('AND event = ?');
    expect(db.statements[0].values).toEqual(['app', 'env', 'warn', 'error', 'signup', 7]);

    await control.listLogs('app', 'env', { minLevel: 'debug', limit: 1 });
    expect(db.statements[1].values).toEqual(['app', 'env', 'debug', 'info', 'warn', 'error', 1]);
    expect(db.statements[1].sql).not.toContain('AND event');
  });

  it('prunes expired logs in bounded batches', async () => {
    const db = new FakeDatabase();
    const removed = await new D1ControlPlane(db).cleanupLogsExpired(NOW, 10);
    expect(removed).toBe(3);
    expect(db.statements[0].sql).toContain('DELETE FROM log_events');
    expect(db.statements[0].values).toEqual([NOW, 10]);
  });

  it('runs log cleanup from the scheduled handler', async () => {
    const db = new FakeDatabase();
    await worker.scheduled(undefined, { DB: db });
    expect(
      db.statements.some((statement) => statement.sql.includes('DELETE FROM log_events')),
    ).toBe(true);
  });
});
