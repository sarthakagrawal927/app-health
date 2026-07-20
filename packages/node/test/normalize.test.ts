import { describe, expect, it } from 'vitest';
import {
  normalizeDuration,
  normalizeMethod,
  normalizeRelease,
  normalizeRoutePath,
  normalizeStatus,
  normalizeTimestamp,
} from '../src/index.js';

describe('normalizeMethod', () => {
  it('uppercases and trims valid methods', () => {
    expect(normalizeMethod('get')).toBe('GET');
    expect(normalizeMethod('  post  ')).toBe('POST');
  });
  it('rejects non-letter, empty, and oversized methods', () => {
    expect(normalizeMethod('G3T')).toBeNull();
    expect(normalizeMethod('')).toBeNull();
    expect(normalizeMethod(null)).toBeNull();
    expect(normalizeMethod('X'.repeat(20))).toBeNull();
  });
});

describe('normalizeRoutePath', () => {
  it('preserves framework-style templates verbatim', () => {
    expect(normalizeRoutePath('/users/:id')).toBe('/users/:id');
    expect(normalizeRoutePath('/orders/:id/items/:itemId')).toBe('/orders/:id/items/:itemId');
  });
  it('collapses numeric segments to :id', () => {
    expect(normalizeRoutePath('/users/123')).toBe('/users/:id');
    expect(normalizeRoutePath('/orders/42/items/7')).toBe('/orders/:id/items/:id');
  });
  it('collapses UUID v4 segments to :id', () => {
    expect(normalizeRoutePath('/users/550e8400-e29b-41d4-a716-446655440000')).toBe('/users/:id');
  });
  it('does not merge alphanumeric non-identifier segments', () => {
    expect(normalizeRoutePath('/orders/abc-123')).toBe('/orders/abc-123');
    expect(normalizeRoutePath('/health')).toBe('/health');
  });
  it('strips query and fragment defensively', () => {
    expect(normalizeRoutePath('/users/1?token=secret')).toBe('/users/:id');
    expect(normalizeRoutePath('/users/1#section')).toBe('/users/:id');
  });
  it('rejects non-strings and paths not starting with /', () => {
    expect(normalizeRoutePath('users/1')).toBeNull();
    expect(normalizeRoutePath(undefined)).toBeNull();
    expect(normalizeRoutePath('')).toBeNull();
  });
});

describe('normalizeStatus / duration / release / timestamp', () => {
  it('accepts integer status codes in HTTP range', () => {
    expect(normalizeStatus(200)).toBe(200);
    expect(normalizeStatus(404)).toBe(404);
    expect(normalizeStatus(500)).toBe(500);
  });
  it('rejects out-of-range or non-integer status', () => {
    expect(normalizeStatus(99)).toBeNull();
    expect(normalizeStatus(600)).toBeNull();
    expect(normalizeStatus(200.5)).toBeNull();
    expect(normalizeStatus('200')).toBeNull();
  });
  it('rounds and bounds durations', () => {
    expect(normalizeDuration(12.4)).toBe(12);
    expect(normalizeDuration(12.6)).toBe(13);
    expect(normalizeDuration(0)).toBe(0);
    expect(normalizeDuration(-1)).toBe(0);
    expect(normalizeDuration(-100)).toBe(0);
    expect(normalizeDuration(601_000)).toBeNull();
    expect(normalizeDuration(NaN)).toBeNull();
  });
  it('trims and bounds release, returning undefined when absent', () => {
    expect(normalizeRelease(undefined)).toBeUndefined();
    expect(normalizeRelease('  v1.2.3  ')).toBe('v1.2.3');
    expect(normalizeRelease('')).toBeUndefined();
    expect(normalizeRelease('x'.repeat(200))).toBeUndefined();
    expect(normalizeRelease(123)).toBeUndefined();
  });
  it('rounds and validates timestamps', () => {
    expect(normalizeTimestamp(1_725_000_000_000)).toBe(1_725_000_000_000);
    expect(normalizeTimestamp(-1)).toBeNull();
    expect(normalizeTimestamp('abc')).toBeNull();
  });
});
