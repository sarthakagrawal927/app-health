// V0 worker service layer. Orchestrates the repository interfaces to
// implement app creation, key revocation, authenticated ingest, installation
// status, and endpoint queries. The same service works against the in-memory
// adapter today and a future D1 implementation after deploy approval.

import {
  BUCKET_MS,
  CreateAppRequestV1,
  FAILURE_RETENTION_HOURS,
  FailureQueryResponseV1,
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
  type FailureQueryResponseV1 as FailureQueryResponse,
  type KeyRecordV1,
  type ListAppsResponseV1,
  type Window,
} from '@app-health/contracts';
import { SEED_APP_ID, SEED_ENV_ID } from '@app-health/contracts';
import type { AppHealthRepositories } from './repository.js';
import { isErrorStatus } from './in-memory-adapter.js';

/** Result of an ingest attempt. */
export type IngestResult =
  { ok: true; accepted: number; duplicates: number } | { ok: false; status: number; error: string };

export type EndpointEvent = EventV1 & { upstream_sampled?: boolean };

/** V0 worker service. Stateless aside from the injected repositories. */
export class AppHealthService {
  constructor(private readonly repos: AppHealthRepositories) {}

  /** Create an app + environment + one-time ingest key. */
  async createApp(request: CreateAppRequest, now: number): Promise<CreateAppResponseV1> {
    if (this.repos.setup) {
      const created = await this.repos.setup.createAppEnvironmentKey(
        request.name,
        request.environment,
        now,
      );
      return {
        app: created.app,
        environment: created.environment,
        key: {
          key: created.rawKey,
          app_id: created.record.app_id,
          environment_id: created.record.environment_id,
          created_at: created.record.created_at,
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

  async listApps(): Promise<ListAppsResponseV1> {
    const apps = await this.repos.apps.listApps();
    return {
      apps: await Promise.all(
        apps.map(async (app) => ({
          app,
          environments: await this.repos.environments.listEnvironments(app.id),
        })),
      ),
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
   * - Deduplicates retried SDK batches for a bounded window.
   * - Updates one-minute aggregate buckets only; no raw event is persisted.
   */
  async ingest(rawKey: string, body: unknown, now: number): Promise<IngestResult> {
    const keyRecord = await this.verifyIngestKey(rawKey);
    if (!keyRecord) {
      return {
        ok: false,
        status: 401,
        error: rawKey ? 'invalid or revoked ingest key' : 'missing ingest key',
      };
    }
    const validation = validateBatch(body);
    if (!validation.ok) {
      return { ok: false, status: 400, error: 'invalid v1 batch' };
    }
    const batch: EventBatchV1 = validation.batch;
    for (const event of batch.events) {
      if (Math.abs(event.timestamp - now) > MAX_CLOCK_SKEW_MS) {
        return { ok: false, status: 400, error: 'event timestamp outside clock-skew window' };
      }
    }
    const batchId = batch.batch_id ?? (await legacyBatchID(batch));
    const seen = await this.repos.dedupe.markSeen(
      keyRecord.app_id,
      keyRecord.environment_id,
      batchId,
      now,
    );
    if (!seen) return { ok: true, accepted: 0, duplicates: batch.events.length };
    try {
      return await this.persistEvents(
        keyRecord,
        batch.runtime,
        batch.release,
        batch.events,
        0,
        now,
      );
    } catch (error) {
      await this.repos.dedupe.forget(keyRecord.app_id, keyRecord.environment_id, batchId);
      throw error;
    }
  }

  /** Resolve one environment-scoped ingest key before decoding an OTLP payload. */
  async verifyIngestKey(rawKey: string): Promise<KeyRecordV1 | null> {
    if (!rawKey) return null;
    return this.repos.keys.verifyKey(rawKey);
  }

  /** Process projected OTLP endpoint events through the shared aggregate path. */
  async ingestEvents(
    keyRecord: KeyRecordV1,
    runtime: 'node' | 'go' | 'otel',
    release: string | undefined,
    events: readonly EndpointEvent[],
    now: number,
  ): Promise<IngestResult> {
    for (const event of events) {
      if (Math.abs(event.timestamp - now) > MAX_CLOCK_SKEW_MS) {
        return { ok: false, status: 400, error: 'event timestamp outside clock-skew window' };
      }
    }

    const acceptedEvents: EndpointEvent[] = [];
    const acceptedEventIds: string[] = [];
    let duplicates = 0;
    for (const event of events) {
      const seen = await this.repos.dedupe.markSeen(
        keyRecord.app_id,
        keyRecord.environment_id,
        event.event_id,
        now,
      );
      if (!seen) {
        duplicates += 1;
        continue;
      }
      acceptedEvents.push(event);
      acceptedEventIds.push(event.event_id);
    }

    try {
      return await this.persistEvents(keyRecord, runtime, release, acceptedEvents, duplicates, now);
    } catch (error) {
      await Promise.all(
        acceptedEventIds.map((eventId) =>
          this.repos.dedupe.forget(keyRecord.app_id, keyRecord.environment_id, eventId),
        ),
      );
      throw error;
    }
  }

  private async persistEvents(
    keyRecord: KeyRecordV1,
    runtime: 'node' | 'go' | 'otel',
    release: string | undefined,
    acceptedEvents: readonly EndpointEvent[],
    duplicates: number,
    now: number,
  ): Promise<IngestResult> {
    await this.repos.inventory?.recordObserved(
      keyRecord.app_id,
      keyRecord.environment_id,
      acceptedEvents,
    );
    await this.repos.failures?.recordFailures(
      keyRecord.app_id,
      keyRecord.environment_id,
      acceptedEvents,
    );
    if (this.repos.buckets.upsertEvents) {
      await this.repos.buckets.upsertEvents(
        keyRecord.app_id,
        keyRecord.environment_id,
        runtime,
        release,
        acceptedEvents,
      );
    } else {
      for (const event of acceptedEvents) await this.applyEvent(keyRecord, event);
    }
    if (acceptedEvents.length > 0) {
      await this.repos.installation.recordIngest(
        keyRecord.app_id,
        keyRecord.environment_id,
        runtime,
        now,
      );
    }
    return { ok: true, accepted: acceptedEvents.length, duplicates };
  }

  private async applyEvent(keyRecord: KeyRecordV1, event: EndpointEvent): Promise<void> {
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
      upstreamSampled: event.upstream_sampled,
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
    const endpoints = mergeBuckets(buckets, window, now);
    const measured = new Set(
      endpoints.map((endpoint) => `${endpoint.method}\u0000${endpoint.route}`),
    );
    for (const observed of (await this.repos.inventory?.listObserved(appId, envId)) ?? []) {
      if (measured.has(`${observed.method}\u0000${observed.route}`)) continue;
      endpoints.push({
        method: observed.method,
        route: observed.route,
        request_count: 0,
        error_count: 0,
        error_rate: 0,
        p50_ms: 0,
        p95_ms: 0,
        last_seen: observed.last_seen,
        health_state: 'insufficient-data',
        metrics_available: false,
      });
    }
    return {
      refreshed_at: now,
      window,
      endpoints,
    };
  }

  /** Query the latest retained 4xx/5xx details for one app environment. */
  async queryFailures(
    appId: string,
    envId: string,
    limit: number,
    now: number,
  ): Promise<FailureQueryResponse> {
    const failures =
      (await this.repos.failures?.listFailures(
        appId,
        envId,
        now - FAILURE_RETENTION_HOURS * 60 * 60 * 1000,
        limit,
      )) ?? [];
    return FailureQueryResponseV1.parse({
      refreshed_at: now,
      retention_hours: FAILURE_RETENTION_HOURS,
      limit,
      failures,
    });
  }
}

async function legacyBatchID(batch: EventBatchV1): Promise<string> {
  const input = batch.events.map((event) => event.event_id).join('\u0000');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `legacy-${hex}`;
}

// Re-export the request validator so the worker route can parse bodies.
export { CreateAppRequestV1 };
