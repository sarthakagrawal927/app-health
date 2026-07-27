// Distribution-safe subset of the V1 ingest contract used by the Node SDK.
// Keep these values aligned with packages/contracts/src/constants.ts; the
// parity test fails if the canonical contract changes without the SDK.

export const SCHEMA_VERSION = 'v1' as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

export const MAX_BATCH_EVENTS = 1000;
export const MAX_METHOD_LENGTH = 16;
export const MAX_ROUTE_LENGTH = 256;
export const MAX_RELEASE_LENGTH = 128;
export const MAX_DURATION_MS = 600_000;
export const MIN_STATUS_CODE = 100;
export const MAX_STATUS_CODE = 599;

export type RuntimeField = 'node' | 'worker' | 'go' | 'otel';

export interface EventV1 {
  event_id: string;
  timestamp: number;
  method: string;
  route: string;
  status_code: number;
  duration_ms: number;
  release?: string;
}

export interface EventBatchV1 {
  batch_id: string;
  schema_version: SchemaVersion;
  runtime: RuntimeField;
  environment?: string;
  release?: string;
  events: EventV1[];
}
