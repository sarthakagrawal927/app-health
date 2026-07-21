import { z } from 'zod';
import {
  MAX_DURATION_MS,
  MAX_METHOD_LENGTH,
  MAX_RELEASE_LENGTH,
  MAX_ROUTE_LENGTH,
} from './constants.js';

export const FAILURE_RETENTION_HOURS = 24;
export const DEFAULT_FAILURE_QUERY_LIMIT = 50;
export const MAX_FAILURE_QUERY_LIMIT = 100;

export const FailureQueryRequestV1 = z
  .object({
    app_id: z.string().min(1),
    environment_id: z.string().min(1),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_FAILURE_QUERY_LIMIT)
      .default(DEFAULT_FAILURE_QUERY_LIMIT),
  })
  .strict();

export type FailureQueryRequestV1 = z.infer<typeof FailureQueryRequestV1>;

export const FailureEventV1 = z
  .object({
    failure_id: z.string().min(1),
    method: z.string().min(1).max(MAX_METHOD_LENGTH),
    route: z.string().min(1).max(MAX_ROUTE_LENGTH),
    status_code: z.number().int().min(400).max(599),
    duration_ms: z.number().int().min(0).max(MAX_DURATION_MS),
    occurred_at: z.number().int().min(0),
    release: z.string().min(1).max(MAX_RELEASE_LENGTH).nullable(),
  })
  .strict();

export type FailureEventV1 = z.infer<typeof FailureEventV1>;

export const FailureQueryResponseV1 = z.object({
  refreshed_at: z.number().int().min(0),
  retention_hours: z.literal(FAILURE_RETENTION_HOURS),
  limit: z.number().int().min(1).max(MAX_FAILURE_QUERY_LIMIT),
  failures: z.array(FailureEventV1),
});

export type FailureQueryResponseV1 = z.infer<typeof FailureQueryResponseV1>;
