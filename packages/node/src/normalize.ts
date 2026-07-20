// Conservative field and route normalization for the V1 contract.
//
// The V1 event only carries method, route template, status_code, duration_ms,
// timestamp, and optional release. This module normalizes framework-provided
// values into the bounded, uppercase, slash-prefixed shape the contract
// requires, with a conservative fallback that collapses obvious numeric and
// UUID path segments into a single `:id` placeholder when no framework route
// template is available. It never reads headers, query, params, or bodies.

import {
  MAX_METHOD_LENGTH,
  MAX_RELEASE_LENGTH,
  MAX_ROUTE_LENGTH,
  MAX_STATUS_CODE,
  MAX_DURATION_MS,
  MIN_STATUS_CODE,
} from '@app-health/contracts';

/** Uppercase, trim, and bound an HTTP method. Returns null if not normalizable. */
export function normalizeMethod(method: unknown): string | null {
  if (typeof method !== 'string') return null;
  const upper = method.trim().toUpperCase();
  if (upper.length === 0 || upper.length > MAX_METHOD_LENGTH) return null;
  if (!/^[A-Z]+$/.test(upper)) return null;
  return upper;
}

/**
 * Conservative concrete-path fallback normalization.
 *
 * Replaces segments that are clearly identifiers (all digits, or a UUID v4)
 * with `:id`. Other segments are preserved verbatim so distinct routes are
 * not accidentally merged. Query strings are never part of `pathname` from
 * Express, and we explicitly strip anything after `?` defensively.
 */
export function normalizeRoutePath(path: unknown): string | null {
  if (typeof path !== 'string') return null;
  let p = path.trim();
  const q = p.indexOf('?');
  if (q >= 0) p = p.slice(0, q);
  const h = p.indexOf('#');
  if (h >= 0) p = p.slice(0, h);
  if (p.length === 0 || !p.startsWith('/')) return null;
  const segments = p.split('/');
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === '') {
      // Preserve leading empty segment and doubled slashes collapse naturally.
      out.push('');
      continue;
    }
    out.push(isIdentifierSegment(seg) ? ':id' : seg);
  }
  const normalized = out.join('/');
  if (normalized.length > MAX_ROUTE_LENGTH) return null;
  return normalized;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_RE = /^\d+$/;

function isIdentifierSegment(segment: string): boolean {
  return NUMERIC_RE.test(segment) || UUID_RE.test(segment);
}

/** Bound and validate a status code. Returns null if out of HTTP range. */
export function normalizeStatus(status: unknown): number | null {
  if (typeof status !== 'number' || !Number.isInteger(status)) return null;
  if (status < MIN_STATUS_CODE || status > MAX_STATUS_CODE) return null;
  return status;
}

/** Bound and validate a duration in milliseconds. Returns null if invalid. */
export function normalizeDuration(durationMs: unknown): number | null {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs)) return null;
  if (durationMs < 0) return null;
  const rounded = Math.round(durationMs);
  if (!Number.isInteger(rounded)) return null;
  if (rounded < 0 || rounded > MAX_DURATION_MS) return null;
  return rounded;
}

/** Bound and validate an optional release tag. Returns undefined when absent. */
export function normalizeRelease(release: unknown): string | undefined {
  if (release === undefined || release === null) return undefined;
  if (typeof release !== 'string') return undefined;
  const trimmed = release.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_RELEASE_LENGTH) return undefined;
  return trimmed;
}

/** Bound and validate a timestamp in epoch milliseconds. Returns null if invalid. */
export function normalizeTimestamp(timestamp: unknown): number | null {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return null;
  const rounded = Math.round(timestamp);
  if (!Number.isInteger(rounded) || rounded < 0) return null;
  return rounded;
}
