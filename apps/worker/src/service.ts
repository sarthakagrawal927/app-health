// V0 worker service layer. Orchestrates the repository interfaces to
// implement app creation, key revocation, authenticated ingest, installation
// status, and endpoint queries. The same service works against the in-memory
// adapter today and a future D1 implementation after deploy approval.

import {
  BUCKET_MS,
  CreateAppRequestV1,
  InstallationStatusV1,
  MAX_CLOCK_SKEW_MS,
  WINDOW_MS,
  buildSeedBuckets,
  mergeBuckets,
  validateBatch,
  type CreateAppRequestV1 as CreateAppRequest,
  type CreateAppResponseV1,
  type EndpointQueryResponseV1,
  type EventBatchV1,
  type EventV1,
  type KeyRecordV1,
  type Window,
} from '@app-health/contracts';
import {
  SEED_APP_ID,
  SEED_APP_NAME,
  SEED_ENV_ID,
  SEED_ENV_NAME,
  SEED_KEY,
} from '@app-health/contracts';
import type { AppHealthRepositories } from './repository.js';
import { isErrorStatus } from './in-memory-adapter.js';

/** Result of an ingest attempt. */
export type IngestResult =
  { ok: true; accepted: number; duplicates: number } | { ok: false; status: number; error: string };

/** V0 worker service. Stateless aside from the injected repositories. */
export class AppHealthService {
  constructor(private readonly repos: AppHealthRepositories) {}

  /** Create an app + environment + one-time ingest key. */
  async createApp(request: CreateAppRequest, now: number): Promise<CreateAppResponseV1> {
    // The seeded demo app is returned idempotently for the seed name pair so
    // the dashboard has a stable demo surface. Other names create new records.
    if (request.name === SEED_APP_NAME && request.environment === SEED_ENV_NAME) {
      const seedApp = await this.repos.apps.getApp(SEED_APP_ID);
      const seedEnv = await this.repos.environments.getEnvironment(SEED_ENV_ID);
      const seedKey = await this.repos.keys.getActiveKeyForEnvironment(SEED_APP_ID, SEED_ENV_ID);
      return {
        app: seedApp!,
        environment: seedEnv!,
        key: {
          key: SEED_KEY,
          app_id: SEED_APP_ID,
          environment_id: SEED_ENV_ID,
          created_at: seedKey?.created_at ?? now,
        },
      };
    }
    const app = await this.repos.apps.createApp(request.name, now);
    const env = await this.repos.environments.createEnvironment(app.id, request.environment, now);
    const { record, rawKey } = await this.repos.keys.createKey(app.id, env.id, now);
    return {
      app,
      environment: env,
      key: {
        key: rawKey,
        app_id: record.app_id,
        environment_id: record.environment_id,
        created_at: record.created_at,
      },
    };
  }

  /** Revoke an ingest key by id. */
  async revokeKey(keyId: string, now: number): Promise<void> {
    await this.repos.keys.revokeKey(keyId, now);
  }

  /**
   * Authenticate and process a v1 ingest batch.
   * - Verifies the environment-scoped key (non-reversible SHA-256 lookup).
   * - Validates the schema version and bounded event fields; rejects unknown
   *   unsafe fields rather than stripping them.
   * - Checks per-event clock skew against the server time.
   * - Deduplicates retried event IDs for a bounded window.
   * - Updates one-minute aggregate buckets only; no raw event is persisted.
   */
  async ingest(rawKey: string, body: unknown, now: number): Promise<IngestResult> {
    if (!rawKey) return { ok: false, status: 401, error: 'missing ingest key' };
    const keyRecord = await this.repos.keys.verifyKey(rawKey);
    if (!keyRecord) {
      return { ok: false, status: 401, error: 'invalid or revoked ingest key' };
    }
    const validation = validateBatch(body);
    if (!validation.ok) {
      return { ok: false, status: 400, error: 'invalid v1 batch' };
    }
    const batch: EventBatchV1 = validation.batch;
    // Clock skew: reject the batch if any event timestamp is too far from now.
    for (const event of batch.events) {
      if (Math.abs(event.timestamp - now) > MAX_CLOCK_SKEW_MS) {
        return { ok: false, status: 400, error: 'event timestamp outside clock-skew window' };
      }
    }
    const runtime = batch.runtime;
    let accepted = 0;
    let duplicates = 0;
    for (const event of batch.events) {
      const seen = await this.repos.dedupe.markSeen(event.event_id, now);
      if (!seen) {
        duplicates += 1;
        continue;
      }
      await this.applyEvent(keyRecord, event);
      accepted += 1;
    }
    if (accepted > 0) {
      await this.repos.installation.recordIngest(
        keyRecord.app_id,
        keyRecord.environment_id,
        runtime,
        now,
      );
    }
    return { ok: true, accepted, duplicates };
  }

  private async applyEvent(keyRecord: KeyRecordV1, event: EventV1): Promise<void> {
    const bucketStart = Math.floor(event.timestamp / BUCKET_MS) * BUCKET_MS;
    await this.repos.buckets.upsertBucket({
      app_id: keyRecord.app_id,
      environment_id: keyRecord.environment_id,
      bucket_start: bucketStart,
      method: event.method,
      route: event.route,
      statusIsError: isErrorStatus(event.status_code),
      durationMs: event.duration_ms,
      timestamp: event.timestamp,
    });
  }

  /** Read installation status for the setup view. */
  async installationStatus(
    appId: string,
    envId: string,
    now: number,
  ): Promise<InstallationStatusV1> {
    const status = await this.repos.installation.getStatus(appId, envId, now);
    return InstallationStatusV1.parse(status);
  }

  /** Query observed endpoints for a window, scoped to (app_id, environment_id). */
  async queryEndpoints(
    appId: string,
    envId: string,
    window: Window,
    now: number,
  ): Promise<EndpointQueryResponseV1> {
    const from = now - WINDOW_MS[window];
    const buckets = await this.repos.buckets.queryBuckets(appId, envId, from, now);
    // For the seeded demo app, include seeded buckets so the dashboard renders
    // a populated table even before any real ingest traffic.
    if (appId === SEED_APP_ID && envId === SEED_ENV_ID) {
      const seedBuckets = buildSeedBuckets(now);
      const existingKeys = new Set(buckets.map((b) => `${b.bucket_start}|${b.method}|${b.route}`));
      for (const seed of seedBuckets) {
        if (!existingKeys.has(`${seed.bucket_start}|${seed.method}|${seed.route}`)) {
          buckets.push({ ...seed, histogram: [...seed.histogram] });
        }
      }
    }
    return {
      refreshed_at: now,
      window,
      endpoints: mergeBuckets(buckets, window, now),
    };
  }
}

// Re-export the request validator so the worker route can parse bodies.
export { CreateAppRequestV1 };
