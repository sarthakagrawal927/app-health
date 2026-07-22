import { describe, expect, it } from 'vitest';
import { WINDOW_MS } from '@app-health/contracts';
import { AnalyticsEngineBuckets, telemetryScope } from '../src/analytics-engine.js';

describe('Analytics Engine telemetry adapter', () => {
  it('aggregates equivalent events and writes only approved dimensions', async () => {
    const points: unknown[] = [];
    const adapter = new AnalyticsEngineBuckets(
      { writeDataPoint: (point) => points.push(point) },
      async () => [],
    );
    await adapter.upsertEvents('app-a', 'env-a', 'node', 'r1', [
      { timestamp: 100, method: 'GET', route: '/users/:id', status_code: 200, duration_ms: 12 },
      { timestamp: 101, method: 'GET', route: '/users/:id', status_code: 503, duration_ms: 20 },
    ]);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({
      blobs: ['GET', '/users/:id', '3', 'node', 'r1'],
      doubles: [2, 1, 32, 101],
    });
    expect(JSON.stringify(points[0])).not.toMatch(
      /event_id|header|cookie|body|identity|stack|trace/i,
    );
  });

  it('uses fixed sampling-aware SQL and rebuilds a weighted histogram', async () => {
    let sql = '';
    const adapter = new AnalyticsEngineBuckets(
      { writeDataPoint: () => undefined },
      async (query) => {
        sql = query;
        return [
          {
            method: 'GET',
            route: '/health',
            latency_bucket: 2,
            request_count: 20,
            error_count: 1,
            duration_sum_ms: 200,
            last_seen: 500,
          },
        ];
      },
    );
    const rows = await adapter.queryBuckets('app-a', 'env-a', 1000 - WINDOW_MS['15m'], 1000);
    expect(rows[0].histogram[2]).toBe(20);
    expect(rows[0].request_count).toBe(20);
    expect(sql).toContain('app_health_endpoint_v1');
    expect(sql).toContain('_sample_interval');
    expect(sql).toContain(await telemetryScope('app-a', 'env-a'));
    expect(sql).toContain("blob5 != 'polaris-staging-canary'");
    expect(sql).not.toContain('app-a');
  });

  it('rejects more than 250 expanded points before writing', async () => {
    const points: unknown[] = [];
    const adapter = new AnalyticsEngineBuckets(
      { writeDataPoint: (point) => points.push(point) },
      async () => [],
    );
    const events = Array.from({ length: 251 }, (_, index) => ({
      timestamp: index,
      method: 'GET',
      route: `/route-${index}`,
      status_code: 200,
      duration_ms: 10,
    }));
    await expect(adapter.upsertEvents('app-a', 'env-a', 'node', undefined, events)).rejects.toThrow(
      /250/,
    );
    expect(points).toHaveLength(0);
  });
});
