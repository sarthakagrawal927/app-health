// Normalization for `client.log()`. Logs are owner-authored, so the SDK keeps
// what the caller sends but enforces the contract bounds: a valid event name,
// a known level, bounded text, and at most LOG_BOUNDS.props scalar props. Anything
// that cannot be made valid is dropped and counted in diagnostics.

import {
  LOG_BOUNDS,
  LOG_EVENT_PATTERN,
  LOG_LEVELS,
  type LogEventV1,
  type LogLevel,
  type LogPropValue,
} from './contracts.js';

/** Input accepted by `log()`. */
export interface LogInput {
  /** debug | info | warn | error. Default info. */
  level?: LogLevel;
  /** Human-readable headline, e.g. the signup email. */
  title?: string;
  description?: string;
  /** One or two emoji shown next to the event. */
  icon?: string;
  /** Flat bag of strings, numbers, booleans, or null. `undefined` values are skipped. */
  props?: Record<string, LogPropValue | undefined>;
  /** Optional; defaults to the current time. */
  timestamp?: number;
}

function boundedText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function normalizeLevel(value: unknown): LogLevel | null {
  if (value === undefined) return 'info';
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value)
    ? (value as LogLevel)
    : null;
}

const INVALID = Symbol('invalid');

function normalizePropValue(raw: unknown): LogPropValue | typeof INVALID {
  if (raw === null || typeof raw === 'boolean') return raw;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : INVALID;
  if (typeof raw === 'string') return boundedText(raw, LOG_BOUNDS.propValue) ?? '';
  return INVALID;
}

function normalizeProps(value: unknown): Record<string, LogPropValue> | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const props: Record<string, LogPropValue> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === undefined) continue;
    const normalized = normalizePropValue(raw);
    if (normalized === INVALID || key.length === 0 || key.length > LOG_BOUNDS.propKey) {
      return null;
    }
    props[key] = normalized;
  }
  return Object.keys(props).length > LOG_BOUNDS.props ? null : props;
}

/** Build a contract-valid log or return null when the input cannot be made valid. */
export function buildLogEventV1(
  event: unknown,
  input: LogInput,
  ctx: { now: () => number; uuid: () => string },
): LogEventV1 | null {
  if (typeof event !== 'string' || !LOG_EVENT_PATTERN.test(event)) return null;
  const level = normalizeLevel(input.level);
  const props = normalizeProps(input.props);
  if (level === null || props === null) return null;
  const timestamp =
    typeof input.timestamp === 'number' && Number.isInteger(input.timestamp) && input.timestamp >= 0
      ? input.timestamp
      : ctx.now();
  const title = boundedText(input.title, LOG_BOUNDS.title);
  const description = boundedText(input.description, LOG_BOUNDS.description);
  const icon = boundedText(input.icon, LOG_BOUNDS.icon);
  return {
    log_id: ctx.uuid(),
    timestamp,
    event,
    level,
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(icon !== undefined ? { icon } : {}),
    props,
  };
}

/** Derive the logs endpoint from the ingest endpoint: `/v1/ingest` becomes `/v1/logs`. */
export function deriveLogsEndpoint(ingestEndpoint: string): string {
  const url = new URL(ingestEndpoint);
  url.pathname = url.pathname.endsWith('/v1/ingest')
    ? url.pathname.replace(/\/v1\/ingest$/, '/v1/logs')
    : '/v1/logs';
  return url.toString();
}
