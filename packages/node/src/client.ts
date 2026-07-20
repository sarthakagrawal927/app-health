// @app-health/node client: bounded async batching, short timeouts, bounded
// retries, queue-pressure drops, graceful flush/close, and local diagnostics.
//
// The client never blocks the application response path. `record()` is
// synchronous, non-blocking, and drops on queue pressure. Delivery happens on
// a timer or size threshold and during `flush()`/`close()`. The application
// response never awaits ingest.

import { MAX_BATCH_EVENTS, SCHEMA_VERSION, type EventV1 } from '@app-health/contracts';
import {
  createDiagnostics,
  type AppHealthDiagnostics,
  type DiagnosticsSink,
} from './diagnostics.js';
import {
  normalizeDuration,
  normalizeMethod,
  normalizeRelease,
  normalizeRoutePath,
  normalizeStatus,
  normalizeTimestamp,
} from './normalize.js';
import { sendBatch, type FetchLike, type TransportResult } from './transport.js';
import { randomUUID } from './uuid.js';

/** Input accepted by `record()`. Only endpoint-summary fields are permitted. */
export interface EventInput {
  method: unknown;
  route: unknown;
  status_code: unknown;
  duration_ms: unknown;
  /** Optional; defaults to the client's configured release. */
  release?: unknown;
  /** Optional; defaults to the current time. */
  timestamp?: unknown;
}

export interface AppHealthClientOptions {
  /** Ingest key scoped to one app and one environment. */
  key: string;
  /** Absolute ingest URL, e.g. http://localhost:8787/v1/ingest. */
  endpoint: string;
  /** Optional release tag applied to every event unless overridden. */
  release?: string;
  /** Maximum events buffered in memory before dropping. Default 10_000. */
  maxQueueSize?: number;
  /** Events per batch. Default 100 (must be <= MAX_BATCH_EVENTS). */
  maxBatchSize?: number;
  /** Auto-flush interval in ms. Default 5_000. */
  flushIntervalMs?: number;
  /** Per-request timeout in ms. Default 2_000. */
  requestTimeoutMs?: number;
  /** Maximum retry attempts per batch. Default 3. */
  maxRetries?: number;
  /** Base retry backoff in ms. Default 100. */
  retryBackoffMs?: number;
  /** Inject a fetch implementation for tests. */
  fetch?: FetchLike;
  /** Inject a clock for tests. */
  now?: () => number;
  /** Inject a UUID generator for tests. */
  randomUUID?: () => string;
  /** Disable the auto-flush timer (useful for tests). */
  disableTimer?: boolean;
}

export interface AppHealthClient {
  /** Queue one endpoint summary. Non-blocking; drops on overflow. */
  record(event: EventInput): void;
  /** Flush all queued events with retries. Resolves when the drain completes. */
  flush(): Promise<void>;
  /** Stop the timer, flush remaining events, and resolve. */
  close(): Promise<void>;
  /** Read-only diagnostic counters. */
  diagnostics(): AppHealthDiagnostics;
}

const DEFAULTS = {
  maxQueueSize: 10_000,
  maxBatchSize: 100,
  flushIntervalMs: 5_000,
  requestTimeoutMs: 2_000,
  maxRetries: 3,
  retryBackoffMs: 100,
} as const;

export function createAppHealthClient(options: AppHealthClientOptions): AppHealthClient {
  if (typeof options?.key !== 'string' || options.key.length === 0) {
    throw new Error('@app-health/node: createAppHealthClient requires a non-empty `key`');
  }
  const endpoint = parseEndpoint(options?.endpoint);
  if (endpoint === null) {
    throw new Error('@app-health/node: createAppHealthClient requires an http(s) `endpoint`');
  }
  const endpointUrl = endpoint;
  const maxQueueSize = boundedInteger(
    'maxQueueSize',
    options.maxQueueSize ?? DEFAULTS.maxQueueSize,
    1,
    1_000_000,
  );
  const maxBatchSize = boundedInteger(
    'maxBatchSize',
    options.maxBatchSize ?? DEFAULTS.maxBatchSize,
    1,
    MAX_BATCH_EVENTS,
  );
  const flushIntervalMs = boundedInteger(
    'flushIntervalMs',
    options.flushIntervalMs ?? DEFAULTS.flushIntervalMs,
    1,
    60 * 60 * 1000,
  );
  const requestTimeoutMs = boundedInteger(
    'requestTimeoutMs',
    options.requestTimeoutMs ?? DEFAULTS.requestTimeoutMs,
    1,
    60_000,
  );
  const maxRetries = boundedInteger('maxRetries', options.maxRetries ?? DEFAULTS.maxRetries, 0, 10);
  const retryBackoffMs = boundedInteger(
    'retryBackoffMs',
    options.retryBackoffMs ?? DEFAULTS.retryBackoffMs,
    0,
    60_000,
  );
  const fetchFn = options.fetch;
  const now = options.now ?? (() => Date.now());
  const uuid = options.randomUUID ?? randomUUID;
  const defaultRelease = normalizeRelease(options.release);

  const diag = createDiagnostics();
  const queue: EventV1[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let flushing: Promise<void> | null = null;
  let closing: Promise<void> | null = null;

  function scheduleFlush(): void {
    if (options.disableTimer || closed || timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      void flush()
        .catch(() => {
          /* errors are recorded in diagnostics */
        })
        .finally(() => {
          if (queue.length > 0) scheduleFlush();
        });
    }, flushIntervalMs);
    if (typeof timer.unref === 'function') timer.unref();
  }

  function record(event: EventInput): void {
    if (closed) return;
    const method = normalizeMethod(event.method);
    const route = normalizeRoutePath(event.route);
    const status = normalizeStatus(event.status_code);
    const duration = normalizeDuration(event.duration_ms);
    if (method === null || route === null || status === null || duration === null) {
      diag.increment('droppedInvalid');
      return;
    }
    const release = normalizeRelease(event.release) ?? defaultRelease;
    const timestamp = normalizeTimestamp(event.timestamp) ?? now();
    if (queue.length >= maxQueueSize) {
      diag.increment('droppedOverflow');
      return;
    }
    const v1Event: EventV1 = {
      event_id: uuid(),
      timestamp,
      method,
      route,
      status_code: status,
      duration_ms: duration,
      ...(release !== undefined ? { release } : {}),
    };
    queue.push(v1Event);
    diag.setQueued(queue.length);
    scheduleFlush();
    if (queue.length >= maxBatchSize) {
      void flush().catch(() => {
        /* recorded in diagnostics */
      });
    }
  }

  async function flush(): Promise<void> {
    if (closed && queue.length === 0) return;
    // Coalesce concurrent flush calls into a single drain.
    if (flushing) return flushing;
    flushing = (async () => {
      try {
        while (queue.length > 0 && !closed) {
          const batch = queue.splice(0, maxBatchSize);
          diag.setQueued(queue.length);
          await deliver(batch);
        }
        // After close, drain remaining even though `closed` is true.
        if (closed) {
          while (queue.length > 0) {
            const batch = queue.splice(0, maxBatchSize);
            diag.setQueued(queue.length);
            await deliver(batch);
          }
        }
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  }

  async function deliver(events: EventV1[]): Promise<void> {
    if (events.length === 0) return;
    const batch = {
      schema_version: SCHEMA_VERSION,
      runtime: 'node' as const,
      ...(defaultRelease !== undefined ? { release: defaultRelease } : {}),
      events,
    };
    const result: TransportResult = await sendBatch(batch, {
      endpoint: endpointUrl,
      key: options.key,
      requestTimeoutMs,
      maxRetries,
      retryBackoffMs,
      ...(fetchFn ? { fetch: fetchFn } : {}),
    });
    if (result.ok) {
      diag.increment('sentBatches');
      diag.increment('sentEvents', events.length);
      if (result.retried > 0) diag.increment('retriedBatches');
      diag.setLastError(null);
    } else {
      diag.increment('failedBatches');
      if (result.retried > 0) diag.increment('retriedBatches');
      // Transport-level retries are already exhausted. Drop the batch to keep
      // the queue bounded and the flush loop terminating; record the loss in
      // diagnostics. Requeuing would risk an unbounded loop on persistent
      // outages and would defeat the fail-open guarantee.
      diag.increment('droppedDelivery', events.length);
      diag.setLastError(result.error);
    }
  }

  function close(): Promise<void> {
    if (closing) return closing;
    closed = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    closing = flush();
    return closing;
  }

  return {
    record,
    flush,
    close,
    diagnostics: () => diag.snapshot(),
  };
}

function parseEndpoint(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function boundedInteger(name: string, value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`@app-health/node: ${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

// Re-export the diagnostics sink type for internal/external typing parity.
export type { DiagnosticsSink };
