import type {
  AppV1,
  EnvironmentV1,
  InstallationStatusV1,
  KeyRecordV1,
  Runtime,
  EventV1,
  FailureEventV1,
} from '@app-health/contracts';
import { generateRawKey, hashKey } from './crypto.js';
import type {
  AppHealthRepositories,
  AppRepository,
  BucketRepository,
  DedupeRepository,
  EndpointInventoryRepository,
  FailureRepository,
  EnvironmentRepository,
  InstallationRepository,
  KeyRepository,
  SetupRepository,
} from './repository.js';

export interface D1RunResult {
  success: boolean;
  meta: { changes?: number };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1RunResult>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1RunResult[]>;
}

const STALE_THRESHOLD_MS = 15 * 60 * 1000;

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export class D1ControlPlane
  implements
    AppRepository,
    EnvironmentRepository,
    KeyRepository,
    InstallationRepository,
    DedupeRepository,
    EndpointInventoryRepository,
    FailureRepository,
    SetupRepository
{
  constructor(private readonly db: D1DatabaseLike) {}

  asRepositories(buckets: BucketRepository): AppHealthRepositories {
    return {
      apps: this,
      environments: this,
      keys: this,
      installation: this,
      dedupe: this,
      inventory: this,
      failures: this,
      buckets,
      setup: this,
    };
  }

  async createAppEnvironmentKey(name: string, environmentName: string, now: number) {
    const app: AppV1 = { id: id('app'), name, created_at: now };
    const environment: EnvironmentV1 = {
      id: id('env'),
      app_id: app.id,
      name: environmentName,
      created_at: now,
    };
    const rawKey = generateRawKey();
    const record: KeyRecordV1 = {
      id: id('key'),
      app_id: app.id,
      environment_id: environment.id,
      verifier_hash: await hashKey(rawKey),
      created_at: now,
      revoked_at: null,
    };
    const results = await this.db.batch([
      this.db
        .prepare('INSERT INTO apps (id, name, created_at) VALUES (?, ?, ?)')
        .bind(app.id, app.name, now),
      this.db
        .prepare('INSERT INTO environments (id, app_id, name, created_at) VALUES (?, ?, ?, ?)')
        .bind(environment.id, app.id, environment.name, now),
      this.db
        .prepare(
          'INSERT INTO keys (id, app_id, environment_id, verifier_hash, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)',
        )
        .bind(record.id, app.id, environment.id, record.verifier_hash, now),
      this.db
        .prepare(
          'INSERT INTO installation_status (app_id, environment_id, runtime, first_seen, last_seen) VALUES (?, ?, NULL, NULL, NULL)',
        )
        .bind(app.id, environment.id),
    ]);
    if (results.some((result) => !result.success)) throw new Error('D1 setup transaction failed');
    return { app, environment, record, rawKey };
  }

  async createApp(name: string, now: number): Promise<AppV1> {
    const app = { id: id('app'), name, created_at: now };
    await this.db
      .prepare('INSERT INTO apps (id, name, created_at) VALUES (?, ?, ?)')
      .bind(app.id, name, now)
      .run();
    return app;
  }

  getApp(appId: string): Promise<AppV1 | null> {
    return this.db
      .prepare('SELECT id, name, created_at FROM apps WHERE id = ?')
      .bind(appId)
      .first<AppV1>();
  }

  async listApps(): Promise<AppV1[]> {
    return (
      await this.db
        .prepare('SELECT id, name, created_at FROM apps ORDER BY created_at DESC')
        .all<AppV1>()
    ).results;
  }

  async createEnvironment(appId: string, name: string, now: number): Promise<EnvironmentV1> {
    const environment = { id: id('env'), app_id: appId, name, created_at: now };
    await this.db
      .prepare('INSERT INTO environments (id, app_id, name, created_at) VALUES (?, ?, ?, ?)')
      .bind(environment.id, appId, name, now)
      .run();
    return environment;
  }

  getEnvironment(envId: string): Promise<EnvironmentV1 | null> {
    return this.db
      .prepare('SELECT id, app_id, name, created_at FROM environments WHERE id = ?')
      .bind(envId)
      .first<EnvironmentV1>();
  }

  async listEnvironments(appId: string): Promise<EnvironmentV1[]> {
    return (
      await this.db
        .prepare(
          'SELECT id, app_id, name, created_at FROM environments WHERE app_id = ? ORDER BY created_at',
        )
        .bind(appId)
        .all<EnvironmentV1>()
    ).results;
  }

  async createKey(appId: string, envId: string, now: number) {
    const rawKey = generateRawKey();
    const record: KeyRecordV1 = {
      id: id('key'),
      app_id: appId,
      environment_id: envId,
      verifier_hash: await hashKey(rawKey),
      created_at: now,
      revoked_at: null,
    };
    await this.db
      .prepare(
        'INSERT INTO keys (id, app_id, environment_id, verifier_hash, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)',
      )
      .bind(record.id, appId, envId, record.verifier_hash, now)
      .run();
    return { record, rawKey };
  }

  async verifyKey(rawKey: string): Promise<KeyRecordV1 | null> {
    const verifier = await hashKey(rawKey);
    return this.db
      .prepare(
        'SELECT id, app_id, environment_id, verifier_hash, created_at, revoked_at FROM keys WHERE verifier_hash = ? AND revoked_at IS NULL',
      )
      .bind(verifier)
      .first<KeyRecordV1>();
  }

  async revokeKey(keyId: string, now: number): Promise<void> {
    await this.db
      .prepare('UPDATE keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
      .bind(now, keyId)
      .run();
  }

  getActiveKeyForEnvironment(appId: string, envId: string): Promise<KeyRecordV1 | null> {
    return this.db
      .prepare(
        'SELECT id, app_id, environment_id, verifier_hash, created_at, revoked_at FROM keys WHERE app_id = ? AND environment_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1',
      )
      .bind(appId, envId)
      .first<KeyRecordV1>();
  }

  async recordIngest(appId: string, envId: string, runtime: Runtime, now: number): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO installation_status (app_id, environment_id, runtime, first_seen, last_seen) VALUES (?, ?, ?, ?, ?) ON CONFLICT(app_id, environment_id) DO UPDATE SET runtime = excluded.runtime, first_seen = COALESCE(installation_status.first_seen, excluded.first_seen), last_seen = excluded.last_seen',
      )
      .bind(appId, envId, runtime, now, now)
      .run();
  }

  async getStatus(appId: string, envId: string, now: number): Promise<InstallationStatusV1> {
    const row = await this.db
      .prepare(
        'SELECT i.runtime, i.first_seen, i.last_seen, EXISTS(SELECT 1 FROM keys k WHERE k.app_id = i.app_id AND k.environment_id = i.environment_id AND k.revoked_at IS NULL) AS has_active_key FROM installation_status i WHERE i.app_id = ? AND i.environment_id = ?',
      )
      .bind(appId, envId)
      .first<{
        runtime: Runtime | null;
        first_seen: number | null;
        last_seen: number | null;
        has_active_key: number;
      }>();
    if (!row)
      return {
        state: 'waiting',
        first_seen: null,
        last_seen: null,
        next_action: 'Issue an ingest key and send one request.',
      };
    if (!row.has_active_key)
      return {
        state: 'revoked',
        runtime: row.runtime ?? undefined,
        first_seen: row.first_seen,
        last_seen: row.last_seen,
        next_action: 'Create a new ingest key.',
      };
    if (row.last_seen === null)
      return {
        state: 'waiting',
        runtime: row.runtime ?? undefined,
        first_seen: row.first_seen,
        last_seen: null,
        next_action: 'Start the service and send one request.',
      };
    if (now - row.last_seen > STALE_THRESHOLD_MS)
      return {
        state: 'stale',
        runtime: row.runtime ?? undefined,
        first_seen: row.first_seen,
        last_seen: row.last_seen,
        next_action: 'Check that the service is running.',
      };
    return {
      state: 'connected',
      runtime: row.runtime ?? undefined,
      first_seen: row.first_seen,
      last_seen: row.last_seen,
      next_action: 'Endpoint summaries are arriving.',
    };
  }

  async markSeen(appId: string, envId: string, batchId: string, now: number): Promise<boolean> {
    const result = await this.db
      .prepare(
        'INSERT OR IGNORE INTO seen_batches (batch_id, app_id, environment_id, seen_at) VALUES (?, ?, ?, ?)',
      )
      .bind(batchId, appId, envId, now)
      .run();
    return (result.meta.changes ?? 0) === 1;
  }

  async forget(appId: string, envId: string, batchId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM seen_batches WHERE app_id = ? AND environment_id = ? AND batch_id = ?')
      .bind(appId, envId, batchId)
      .run();
  }

  async cleanupExpired(before: number, limit: number): Promise<number> {
    const result = await this.db
      .prepare(
        'DELETE FROM seen_batches WHERE rowid IN (SELECT rowid FROM seen_batches WHERE seen_at < ? ORDER BY seen_at LIMIT ?)',
      )
      .bind(before, limit)
      .run();
    return result.meta.changes ?? 0;
  }

  async recordFailures(appId: string, envId: string, events: readonly EventV1[]): Promise<void> {
    const failures = events.filter((event) => event.status_code >= 400);
    if (failures.length === 0) return;
    const results = await this.db.batch(
      failures.map((event) =>
        this.db
          .prepare(
            'INSERT OR IGNORE INTO failure_events (failure_id, app_id, environment_id, method, route, status_code, duration_ms, occurred_at, release) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            event.event_id,
            appId,
            envId,
            event.method,
            event.route,
            event.status_code,
            event.duration_ms,
            event.timestamp,
            event.release ?? null,
          ),
      ),
    );
    if (results.some((result) => !result.success)) throw new Error('D1 failure insert failed');
  }

  async listFailures(
    appId: string,
    envId: string,
    from: number,
    limit: number,
  ): Promise<FailureEventV1[]> {
    return (
      await this.db
        .prepare(
          'SELECT failure_id, method, route, status_code, duration_ms, occurred_at, release FROM failure_events WHERE app_id = ? AND environment_id = ? AND occurred_at >= ? ORDER BY occurred_at DESC, failure_id DESC LIMIT ?',
        )
        .bind(appId, envId, from, limit)
        .all<FailureEventV1>()
    ).results;
  }

  async cleanupFailuresExpired(before: number, limit: number): Promise<number> {
    const result = await this.db
      .prepare(
        'DELETE FROM failure_events WHERE rowid IN (SELECT rowid FROM failure_events WHERE occurred_at < ? ORDER BY occurred_at LIMIT ?)',
      )
      .bind(before, limit)
      .run();
    return result.meta.changes ?? 0;
  }

  async recordObserved(
    appId: string,
    envId: string,
    endpoints: readonly { method: string; route: string; timestamp: number }[],
  ): Promise<void> {
    const unique = new Map<
      string,
      { method: string; route: string; first: number; last: number }
    >();
    for (const endpoint of endpoints) {
      const key = `${endpoint.method}\u0000${endpoint.route}`;
      const current = unique.get(key);
      if (current) {
        current.first = Math.min(current.first, endpoint.timestamp);
        current.last = Math.max(current.last, endpoint.timestamp);
      } else {
        unique.set(key, {
          method: endpoint.method,
          route: endpoint.route,
          first: endpoint.timestamp,
          last: endpoint.timestamp,
        });
      }
    }
    if (unique.size === 0) return;
    const results = await this.db.batch(
      [...unique.values()].map((endpoint) =>
        this.db
          .prepare(
            'INSERT INTO observed_endpoints (app_id, environment_id, method, route, first_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(app_id, environment_id, method, route) DO UPDATE SET first_seen = MIN(observed_endpoints.first_seen, excluded.first_seen), last_seen = MAX(observed_endpoints.last_seen, excluded.last_seen)',
          )
          .bind(appId, envId, endpoint.method, endpoint.route, endpoint.first, endpoint.last),
      ),
    );
    if (results.some((result) => !result.success))
      throw new Error('D1 endpoint inventory update failed');
  }

  async listObserved(appId: string, envId: string) {
    return (
      await this.db
        .prepare(
          'SELECT method, route, first_seen, last_seen FROM observed_endpoints WHERE app_id = ? AND environment_id = ? ORDER BY method, route',
        )
        .bind(appId, envId)
        .all<{ method: string; route: string; first_seen: number; last_seen: number }>()
    ).results;
  }
}
