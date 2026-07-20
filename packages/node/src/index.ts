// @app-health/node — V0 scaffold.
// Wave 0 only re-exports the V1 contract types so consumers can depend on a
// stable package surface. The Express middleware, batching, retries, and
// fail-open delivery are implemented in Wave 1 (tasks 3.1-3.6).

export type { EventV1, EventBatchV1, RuntimeField, SchemaVersion } from '@app-health/contracts';

export {
  SCHEMA_VERSION,
  MAX_BATCH_EVENTS,
  MAX_DURATION_MS,
  MAX_ROUTE_LENGTH,
} from '@app-health/contracts';

/**
 * Placeholder kept until Wave 1 lands the Express middleware. Calling it
 * throws an explicit "not implemented in Wave 0" error so no consumer can
 * accidentally mount a no-op middleware.
 */
export function createAppHealthClient(): never {
  throw new Error(
    '@app-health/node: createAppHealthClient is not implemented in Wave 0. ' +
      'Wave 1 (tasks 3.1-3.6) implements the Express middleware and batching client.',
  );
}
