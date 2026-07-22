import {
  LATENCY_HISTOGRAM_BUCKETS,
  WINDOW_MS,
  type BucketV1,
  type Runtime,
  type Window,
} from '@app-health/contracts';
import { histogramIndex } from './in-memory-adapter.js';
import type { BucketRepository } from './repository.js';

export interface AnalyticsEngineDatasetLike {
  writeDataPoint(point: { indexes: string[]; blobs: string[]; doubles: number[] }): void;
}

interface QueryRow {
  method: string;
  route: string;
  latency_bucket: string | number;
  request_count: string | number;
  error_count: string | number;
  duration_sum_ms: string | number;
  last_seen: string | number | null;
  upstream_sampled?: string | number | null;
}

const DATASET = 'app_health_endpoint_v1';
const MAX_POINTS = 250;
const INTERVALS: Record<Window, string> = {
  '15m': "INTERVAL '15' MINUTE",
  '1h': "INTERVAL '1' HOUR",
  '24h': "INTERVAL '1' DAY",
};

export async function telemetryScope(appId: string, envId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${appId}\u0000${envId}`),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class AnalyticsEngineBuckets implements BucketRepository {
  constructor(
    private readonly dataset: AnalyticsEngineDatasetLike,
    private readonly query: (sql: string) => Promise<QueryRow[]>,
  ) {}

  async upsertBucket(): Promise<void> {
    throw new Error('production telemetry requires batched Analytics Engine writes');
  }

  async upsertEvents(
    appId: string,
    envId: string,
    runtime: Runtime,
    batchRelease: string | undefined,
    events: readonly {
      timestamp: number;
      method: string;
      route: string;
      status_code: number;
      duration_ms: number;
      release?: string;
      upstream_sampled?: boolean;
    }[],
  ): Promise<void> {
    const scope = await telemetryScope(appId, envId);
    const points = new Map<
      string,
      {
        method: string;
        route: string;
        bucket: number;
        release: string;
        count: number;
        errors: number;
        duration: number;
        lastSeen: number;
        upstreamSampled: boolean;
      }
    >();
    for (const event of events) {
      const bucket = histogramIndex(event.duration_ms);
      const release = event.release ?? batchRelease ?? '';
      const key = `${event.method}\u0000${event.route}\u0000${bucket}\u0000${runtime}\u0000${release}`;
      const point = points.get(key) ?? {
        method: event.method,
        route: event.route,
        bucket,
        release,
        count: 0,
        errors: 0,
        duration: 0,
        lastSeen: 0,
        upstreamSampled: false,
      };
      point.count += 1;
      point.errors += event.status_code >= 500 ? 1 : 0;
      point.duration += event.duration_ms;
      point.lastSeen = Math.max(point.lastSeen, event.timestamp);
      point.upstreamSampled ||= event.upstream_sampled === true;
      points.set(key, point);
    }
    if (points.size > MAX_POINTS)
      throw new Error(`ingest expands to more than ${MAX_POINTS} telemetry points`);
    for (const point of points.values()) {
      this.dataset.writeDataPoint({
        indexes: [scope],
        blobs: [
          point.method,
          point.route,
          String(point.bucket),
          runtime,
          point.release,
          point.upstreamSampled ? 'sampled' : '',
        ],
        doubles: [point.count, point.errors, point.duration, point.lastSeen],
      });
    }
  }

  async queryBuckets(appId: string, envId: string, from: number, to: number): Promise<BucketV1[]> {
    const window = windowFor(to - from);
    const scope = await telemetryScope(appId, envId);
    // Analytics Engine is append-only. This exact release was a manually
    // injected connectivity check, not application traffic, so query-tombstone
    // it after its durable D1 inventory and installation state are removed.
    const sql = `SELECT blob1 AS method, blob2 AS route, blob3 AS latency_bucket, SUM(double1 * _sample_interval) AS request_count, SUM(double2 * _sample_interval) AS error_count, SUM(double3 * _sample_interval) AS duration_sum_ms, MAX(double4) AS last_seen, MAX(IF(blob6 = 'sampled', 1, 0)) AS upstream_sampled FROM ${DATASET} WHERE index1 = '${scope}' AND blob5 != 'polaris-staging-canary' AND timestamp >= NOW() - ${INTERVALS[window]} GROUP BY method, route, latency_bucket ORDER BY method, route, latency_bucket`;
    const rows = await this.query(sql);
    const grouped = new Map<string, BucketV1>();
    for (const row of rows) {
      const key = `${row.method}\u0000${row.route}`;
      const bucket = grouped.get(key) ?? {
        app_id: appId,
        environment_id: envId,
        bucket_start: from,
        method: row.method,
        route: row.route,
        request_count: 0,
        error_count: 0,
        duration_sum_ms: 0,
        last_seen: null,
        ...(Number(row.upstream_sampled) > 0 ? { upstream_sampled: true } : {}),
        histogram: new Array<number>(LATENCY_HISTOGRAM_BUCKETS).fill(0),
      };
      const count = Math.max(0, Math.round(Number(row.request_count)));
      const bucketIndex = Number(row.latency_bucket);
      if (
        Number.isInteger(bucketIndex) &&
        bucketIndex >= 0 &&
        bucketIndex < bucket.histogram.length
      ) {
        bucket.histogram[bucketIndex] += count;
      }
      bucket.request_count += count;
      bucket.error_count += Math.max(0, Math.round(Number(row.error_count)));
      bucket.duration_sum_ms += Math.max(0, Math.round(Number(row.duration_sum_ms)));
      const lastSeen = row.last_seen === null ? null : Number(row.last_seen);
      if (Number.isFinite(lastSeen)) bucket.last_seen = Math.max(bucket.last_seen ?? 0, lastSeen!);
      if (Number(row.upstream_sampled) > 0) bucket.upstream_sampled = true;
      grouped.set(key, bucket);
    }
    return [...grouped.values()];
  }
}

function windowFor(duration: number): Window {
  const entry = (Object.entries(WINDOW_MS) as [Window, number][]).find(
    ([, value]) => Math.abs(value - duration) < 1000,
  );
  if (!entry) throw new Error('unsupported Analytics Engine query window');
  return entry[0];
}

export function createAnalyticsQuery(options: {
  accountId: string;
  token: string;
  fetchImpl?: typeof fetch;
}) {
  if (!/^[a-f0-9]{32}$/i.test(options.accountId)) throw new Error('invalid Cloudflare account id');
  if (!options.token) throw new Error('missing Analytics Engine query token');
  const fetchImpl = options.fetchImpl ?? fetch;
  return async (sql: string): Promise<QueryRow[]> => {
    const response = await fetchImpl(
      `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/analytics_engine/sql`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${options.token}`, 'content-type': 'text/plain' },
        body: sql,
      },
    );
    if (!response.ok) throw new Error(`Analytics Engine query failed: ${response.status}`);
    const payload = (await response.json()) as { data?: QueryRow[] };
    return payload.data ?? [];
  };
}
