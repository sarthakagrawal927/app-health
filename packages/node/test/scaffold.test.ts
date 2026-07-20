import { describe, expect, it } from 'vitest';
import { createAppHealthClient, SCHEMA_VERSION } from '../src/index.js';

describe('@app-health/node Wave 0 scaffold', () => {
  it('re-exports the v1 schema version', () => {
    expect(SCHEMA_VERSION).toBe('v1');
  });

  it('throws an explicit not-implemented error from the placeholder client', () => {
    expect(() => createAppHealthClient()).toThrowError(/not implemented in Wave 0/);
  });
});
