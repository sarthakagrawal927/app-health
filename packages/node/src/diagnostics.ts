// Local diagnostic counters for the @saas-maker/app-health client.
// These are intended for operator inspection (logging, /debug endpoints) and
// tests. They are never sent to ingest and never carry request content.

export interface AppHealthDiagnostics {
  /** Events currently waiting in the in-memory queue. */
  queued: number;
  /** Events dropped because the queue was full. */
  droppedOverflow: number;
  /** Events dropped because they failed field normalization. */
  droppedInvalid: number;
  /** Events abandoned after delivery retries were exhausted. */
  droppedDelivery: number;
  /** Batches successfully accepted by ingest (HTTP 2xx). */
  sentBatches: number;
  /** Batches that exhausted retries and were abandoned. */
  failedBatches: number;
  /** Batch send attempts that were retried at least once. */
  retriedBatches: number;
  /** Total events delivered across all successful batches. */
  sentEvents: number;
  /** Human-readable last send error, or null. Cleared on next success. */
  lastSendError: string | null;
}

export function emptyDiagnostics(): AppHealthDiagnostics {
  return {
    queued: 0,
    droppedOverflow: 0,
    droppedInvalid: 0,
    droppedDelivery: 0,
    sentBatches: 0,
    failedBatches: 0,
    retriedBatches: 0,
    sentEvents: 0,
    lastSendError: null,
  };
}

export type DiagnosticsSink = AppHealthDiagnostics & {
  increment: (
    key: Exclude<keyof AppHealthDiagnostics, 'queued' | 'lastSendError'>,
    by?: number,
  ) => void;
  setQueued: (n: number) => void;
  setLastError: (msg: string | null) => void;
  snapshot: () => AppHealthDiagnostics;
};

export function createDiagnostics(): DiagnosticsSink {
  const d = emptyDiagnostics();
  return {
    ...d,
    increment(key, by = 1) {
      d[key] += by;
    },
    setQueued(n) {
      d.queued = n;
    },
    setLastError(msg) {
      d.lastSendError = msg;
    },
    snapshot() {
      return { ...d };
    },
  };
}
