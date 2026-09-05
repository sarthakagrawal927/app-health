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
      LOG_LEVELS: [...sdk.LOG_LEVELS],
      LOG_EVENT_PATTERN: sdk.LOG_EVENT_PATTERN.source,
      MAX_LOG_BATCH: sdk.MAX_LOG_BATCH,
      MAX_LOG_EVENT_LENGTH: sdk.LOG_BOUNDS.event,
      MAX_LOG_TITLE_LENGTH: sdk.LOG_BOUNDS.title,
      MAX_LOG_DESCRIPTION_LENGTH: sdk.LOG_BOUNDS.description,
      MAX_LOG_ICON_LENGTH: sdk.LOG_BOUNDS.icon,
      MAX_LOG_PROPS: sdk.MAX_LOG_PROPS,
      MAX_LOG_PROP_KEY_LENGTH: sdk.LOG_BOUNDS.propKey,
      MAX_LOG_PROP_VALUE_LENGTH: sdk.LOG_BOUNDS.propValue,
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
      LOG_LEVELS: [...canonical.LOG_LEVELS],
      LOG_EVENT_PATTERN: canonical.LOG_EVENT_PATTERN.source,
      MAX_LOG_BATCH: canonical.MAX_LOG_BATCH,
      MAX_LOG_EVENT_LENGTH: canonical.MAX_LOG_EVENT_LENGTH,
      MAX_LOG_TITLE_LENGTH: canonical.MAX_LOG_TITLE_LENGTH,
      MAX_LOG_DESCRIPTION_LENGTH: canonical.MAX_LOG_DESCRIPTION_LENGTH,
      MAX_LOG_ICON_LENGTH: canonical.MAX_LOG_ICON_LENGTH,
      MAX_LOG_PROPS: canonical.MAX_LOG_PROPS,
      MAX_LOG_PROP_KEY_LENGTH: canonical.MAX_LOG_PROP_KEY_LENGTH,
      MAX_LOG_PROP_VALUE_LENGTH: canonical.MAX_LOG_PROP_VALUE_LENGTH,
    });
  });
});
