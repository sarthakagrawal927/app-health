import { describe, expect, it } from 'vitest';
import * as canonical from '../../contracts/src/index.js';
import * as sdk from '../src/contracts.js';

describe('published SDK contract parity', () => {
  it('matches the canonical ingest bounds and schema version', () => {
    expect({
      SCHEMA_VERSION: sdk.SCHEMA_VERSION,
      MAX_BATCH_EVENTS: sdk.MAX_BATCH_EVENTS,
      MAX_METHOD_LENGTH: sdk.MAX_METHOD_LENGTH,
      MAX_ROUTE_LENGTH: sdk.MAX_ROUTE_LENGTH,
      MAX_RELEASE_LENGTH: sdk.MAX_RELEASE_LENGTH,
      MAX_DURATION_MS: sdk.MAX_DURATION_MS,
      MIN_STATUS_CODE: sdk.MIN_STATUS_CODE,
      MAX_STATUS_CODE: sdk.MAX_STATUS_CODE,
      runtimes: ['node', 'worker', 'go', 'otel'] satisfies sdk.RuntimeField[],
    }).toEqual({
      SCHEMA_VERSION: canonical.SCHEMA_VERSION,
      MAX_BATCH_EVENTS: canonical.MAX_BATCH_EVENTS,
      MAX_METHOD_LENGTH: canonical.MAX_METHOD_LENGTH,
      MAX_ROUTE_LENGTH: canonical.MAX_ROUTE_LENGTH,
      MAX_RELEASE_LENGTH: canonical.MAX_RELEASE_LENGTH,
      MAX_DURATION_MS: canonical.MAX_DURATION_MS,
      MIN_STATUS_CODE: canonical.MIN_STATUS_CODE,
      MAX_STATUS_CODE: canonical.MAX_STATUS_CODE,
      runtimes: [...canonical.RUNTIMES],
    });
  });
});
