// @saas-maker/app-health/web — browser log client.
//
// Sends owner-authored application logs from a web page with a *public* log
// key. The key is not a secret: the server pins it to one environment and an
// origin allowlist and rate limits it. Browser logs are stored as
// `source: browser` so the dashboard can tell claims from server facts.
//
// Transport: one POST per batch to /v1/logs as `text/plain` (no CORS
// preflight) with `keepalive`, and `navigator.sendBeacon` when the page is
// hidden or unloading. Nothing here throws into the page.

import {
  PUBLIC_LOG_KEY_PREFIX,
  SCHEMA_VERSION,
  type BrowserLogBatchV1,
  type LogEventV1,
} from './contracts.js';
import { buildLogEventV1, type LogInput } from './log.js';

export type { LogInput } from './log.js';

export interface WebLifecycle {
  /** Subscribe to `pagehide` and `visibilitychange`. */
  addEventListener(type: string, listener: () => void): void;
  /** Current visibility; only `hidden` triggers a beacon flush. */
  visibilityState(): string;
}

export interface WebLoggerOptions {
  /** Public log key (`ahk_pub_…`) created in the dashboard. */
  publicKey: string;
  /** Logs endpoint. Default https://ingest.sassmaker.com/v1/logs. */
  endpoint?: string;
  /** Must match the environment the key was created for; omit to let the key decide. */
  environment?: string;
  /** Auto-flush delay after the first queued log. Default 2000. */
  flushIntervalMs?: number;
  /** Logs kept in memory before dropping. Default 200. */
  maxQueueSize?: number;
  /** Logs per request. Default 50, max 100. */
  maxBatchSize?: number;
  /** Injection points for tests and non-browser hosts. */
  fetch?: (url: string, init: RequestInit) => Promise<{ ok: boolean }>;
  sendBeacon?: (url: string, body: string) => boolean;
  lifecycle?: WebLifecycle | false;
  now?: () => number;
  randomUUID?: () => string;
  disableTimer?: boolean;
}

export interface WebLoggerDiagnostics {
  queued: number;
  sent: number;
  dropped: number;
}

export interface WebLogger {
  /** Queue one log. Never throws; invalid input is dropped and counted. */
  log(event: string, input?: LogInput): void;
  /** Send everything queued with fetch. Resolves when the request settles. */
  flush(): Promise<void>;
  /** Send everything queued with sendBeacon (synchronous). Returns true when the browser accepted it. */
  flushBeacon(): boolean;
  diagnostics(): WebLoggerDiagnostics;
}

const DEFAULT_ENDPOINT = 'https://ingest.sassmaker.com/v1/logs';

// The package compiles without the DOM lib, so browser globals are typed here.
interface BrowserGlobals {
  document?: { visibilityState: string };
  window?: { addEventListener(type: string, listener: () => void): void };
  navigator?: { sendBeacon?: (url: string, data: Blob) => boolean };
}
const browser = globalThis as unknown as BrowserGlobals;

function browserLifecycle(): WebLifecycle | false {
  const { document, window } = browser;
  if (!document || !window) return false;
  return {
    addEventListener: (type, listener) => window.addEventListener(type, listener),
    visibilityState: () => document.visibilityState,
  };
}

function defaultBeacon(url: string, body: string): boolean {
  const send = browser.navigator?.sendBeacon;
  if (typeof send !== 'function') return false;
  return send.call(browser.navigator, url, new Blob([body], { type: 'text/plain' }));
}

function uuidV4(): string {
  return crypto.randomUUID();
}

interface ResolvedWebOptions {
  publicKey: string;
  endpoint: string;
  environment: string | undefined;
  maxQueueSize: number;
  maxBatchSize: number;
  flushIntervalMs: number;
  disableTimer: boolean;
  now: () => number;
  uuid: () => string;
  fetchFn: NonNullable<WebLoggerOptions['fetch']>;
  beacon: NonNullable<WebLoggerOptions['sendBeacon']>;
  lifecycle: WebLifecycle | false;
}

const WEB_DEFAULTS = {
  endpoint: DEFAULT_ENDPOINT,
  maxQueueSize: 200,
  maxBatchSize: 50,
  flushIntervalMs: 2000,
  disableTimer: false,
  now: () => Date.now(),
  randomUUID: uuidV4,
  fetch: (url: string, init: RequestInit) => fetch(url, init),
  sendBeacon: defaultBeacon,
};

function resolveWebOptions(options: WebLoggerOptions): ResolvedWebOptions {
  if (
    typeof options?.publicKey !== 'string' ||
    !options.publicKey.startsWith(PUBLIC_LOG_KEY_PREFIX)
  ) {
    throw new Error(
      `@saas-maker/app-health/web: publicKey must start with ${PUBLIC_LOG_KEY_PREFIX}`,
    );
  }
  const provided = Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  );
  const merged = { ...WEB_DEFAULTS, ...provided } as typeof WEB_DEFAULTS & WebLoggerOptions;
  return {
    publicKey: merged.publicKey,
    endpoint: merged.endpoint,
    environment: merged.environment,
    maxQueueSize: merged.maxQueueSize,
    maxBatchSize: Math.min(merged.maxBatchSize, 100),
    flushIntervalMs: merged.flushIntervalMs,
    disableTimer: merged.disableTimer,
    now: merged.now,
    uuid: merged.randomUUID,
    fetchFn: merged.fetch,
    beacon: merged.sendBeacon,
    lifecycle: merged.lifecycle === undefined ? browserLifecycle() : merged.lifecycle,
  };
}

/** Flush with sendBeacon when the page hides or unloads. */
function attachLifecycle(lifecycle: WebLifecycle | false, flushBeacon: () => boolean): void {
  if (!lifecycle) return;
  lifecycle.addEventListener('pagehide', () => void flushBeacon());
  lifecycle.addEventListener('visibilitychange', () => {
    if (lifecycle.visibilityState() === 'hidden') flushBeacon();
  });
}

export function createWebLogger(options: WebLoggerOptions): WebLogger {
  const cfg = resolveWebOptions(options);
  const queue: LogEventV1[] = [];
  const diag: WebLoggerDiagnostics = { queued: 0, sent: 0, dropped: 0 };
  let timer: ReturnType<typeof setTimeout> | null = null;

  function takeBatch(): { logs: LogEventV1[]; body: string } {
    const logs = queue.splice(0, cfg.maxBatchSize);
    diag.queued = queue.length;
    const batch: BrowserLogBatchV1 = {
      public_key: cfg.publicKey,
      batch_id: cfg.uuid(),
      schema_version: SCHEMA_VERSION,
      ...(cfg.environment !== undefined ? { environment: cfg.environment } : {}),
      logs,
    };
    return { logs, body: JSON.stringify(batch) };
  }

  function settle(logs: LogEventV1[], accepted: boolean): void {
    if (accepted) diag.sent += logs.length;
    else diag.dropped += logs.length;
  }

  async function flush(): Promise<void> {
    if (timer) clearTimeout(timer);
    timer = null;
    while (queue.length > 0) {
      const { logs, body } = takeBatch();
      const accepted = await cfg
        .fetchFn(cfg.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
          body,
          keepalive: true,
        })
        .then((response) => response.ok)
        .catch(() => false);
      settle(logs, accepted);
    }
  }

  function flushBeacon(): boolean {
    if (queue.length === 0) return true;
    const { logs, body } = takeBatch();
    const accepted = cfg.beacon(cfg.endpoint, body);
    settle(logs, accepted);
    return accepted;
  }

  function log(event: string, input: LogInput = {}): void {
    const entry = buildLogEventV1(event, input, { now: cfg.now, uuid: cfg.uuid });
    if (entry === null || queue.length >= cfg.maxQueueSize) {
      diag.dropped += 1;
      return;
    }
    queue.push(entry);
    diag.queued = queue.length;
    if (queue.length >= cfg.maxBatchSize) return void flush();
    if (!cfg.disableTimer && timer === null) {
      timer = setTimeout(() => void flush(), cfg.flushIntervalMs);
    }
  }

  attachLifecycle(cfg.lifecycle, flushBeacon);
  return { log, flush, flushBeacon, diagnostics: () => ({ ...diag }) };
}
