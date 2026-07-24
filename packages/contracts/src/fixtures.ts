// Canonical Node, Cloudflare Worker, and Go contract fixtures for V1.
// All fixtures carry equivalent endpoint summaries (same method, route,
// status_code, duration_ms, and release) so ingest validates them into the
// same internal event shape. Event IDs are unique per fixture because they
// represent distinct observed requests; equivalence is asserted on the
// endpoint-summary fields, not on event_id.

import type { EventBatchV1 } from './event.js';

const NOW = 1_725_000_000_000; // deterministic fixture timestamp

function uuid(seed: number): string {
  // Deterministic RFC 4122 v4 UUID derived from a seed so fixtures are stable.
  const hex = (n: number, len: number): string =>
    Math.abs(Math.floor(n * 2654435761))
      .toString(16)
      .padStart(len, '0')
      .slice(-len);
  return (
    `${hex(seed, 8)}-${hex(seed + 1, 4).slice(0, 4)}-4${hex(seed + 2, 3)}` +
    `-a${hex(seed + 3, 3)}-${hex(seed + 4, 8)
      .padStart(12, '0')
      .slice(-12)}`
  );
}

export interface EndpointSummary {
  method: string;
  route: string;
  status_code: number;
  duration_ms: number;
}

/** Canonical endpoint summaries shared by both Node and Go fixtures. */
export const CANONICAL_ENDPOINT_SUMMARIES: readonly EndpointSummary[] = [
  { method: 'GET', route: '/health', status_code: 200, duration_ms: 12 },
  { method: 'GET', route: '/users/:id', status_code: 200, duration_ms: 45 },
  { method: 'GET', route: '/users/:id', status_code: 404, duration_ms: 38 },
  { method: 'POST', route: '/orders', status_code: 201, duration_ms: 120 },
  { method: 'POST', route: '/orders', status_code: 500, duration_ms: 350 },
  { method: 'GET', route: '/orders/:id', status_code: 200, duration_ms: 88 },
] as const;

/** Build a v1 batch from canonical summaries tagged with a runtime. */
export function buildCanonicalBatch(
  runtime: 'node' | 'worker' | 'go',
  release = '0.0.0-fixture',
  seedBase = runtime === 'node' ? 1000 : runtime === 'worker' ? 1500 : 2000,
): EventBatchV1 {
  return {
    batch_id: uuid(seedBase - 1),
    schema_version: 'v1',
    runtime,
    release,
    events: CANONICAL_ENDPOINT_SUMMARIES.map((summary, index) => ({
      event_id: uuid(seedBase + index * 10),
      timestamp: NOW + index * 1000,
      method: summary.method,
      route: summary.route,
      status_code: summary.status_code,
      duration_ms: summary.duration_ms,
      release,
    })),
  };
}

/** Canonical Node fixture. */
export const nodeBatchFixture = (): EventBatchV1 => buildCanonicalBatch('node');

/** Canonical Cloudflare Worker fixture. */
export const workerBatchFixture = (): EventBatchV1 => buildCanonicalBatch('worker');

/** Canonical Go fixture. */
export const goBatchFixture = (): EventBatchV1 => buildCanonicalBatch('go');

/**
 * Two batches are endpoint-equivalent if, after sorting events by
 * (method, route, status_code, duration_ms), their normalized summaries match.
 * Event IDs and timestamps are intentionally ignored.
 */
export function areEndpointEquivalent(a: EventBatchV1, b: EventBatchV1): boolean {
  const norm = (batch: EventBatchV1) =>
    batch.events
      .map((e) => `${e.method}|${e.route}|${e.status_code}|${e.duration_ms}`)
      .sort()
      .join('\n');
  return norm(a) === norm(b);
}
