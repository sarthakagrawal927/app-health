// @app-health/node — V0 Node SDK for endpoint health.
//
// Public surface:
//   - createAppHealthClient(options): bounded async batching client.
//   - expressMiddleware(options): Express RequestHandler.
//   - normalize* helpers and V1 contract re-exports.
//
// Privacy: only method, normalized route template, status, duration,
// timestamp, and optional release are ever captured or sent. No headers,
// cookies, query values, route parameter values, bodies, identity, logs,
// stacks, or spans.

export { createAppHealthClient } from './client.js';
export type { AppHealthClient, AppHealthClientOptions, EventInput } from './client.js';
export { expressMiddleware } from './middleware.js';
export type { ExpressMiddlewareOptions } from './middleware.js';
export { sendBatch } from './transport.js';
export type { TransportOptions, TransportResult, FetchLike } from './transport.js';
export {
  normalizeMethod,
  normalizeRoutePath,
  normalizeStatus,
  normalizeDuration,
  normalizeRelease,
  normalizeTimestamp,
} from './normalize.js';
export { randomUUID } from './uuid.js';
export type { AppHealthDiagnostics } from './diagnostics.js';

export type { EventV1, EventBatchV1, RuntimeField, SchemaVersion } from '@app-health/contracts';
export {
  SCHEMA_VERSION,
  MAX_BATCH_EVENTS,
  MAX_DURATION_MS,
  MAX_ROUTE_LENGTH,
  MAX_METHOD_LENGTH,
  MAX_RELEASE_LENGTH,
  MIN_STATUS_CODE,
  MAX_STATUS_CODE,
} from '@app-health/contracts';
