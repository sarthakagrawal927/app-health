// V1 application log contract. Unlike endpoint telemetry, logs are explicit,
// owner-authored events an application chooses to send ("signup",
// "waitlist.join", "payment.failed"). They carry whatever the owner puts in
// them, so they are an opt-in surface, retained for a bounded window, and
// never derived from request traffic.

import { z } from 'zod';
import { SCHEMA_VERSION } from './constants.js';
import { EnvironmentName } from './setup.js';

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Maximum logs accepted in a single batch. */
export const MAX_LOG_BATCH = 100;
/** Maximum length of a log event name. */
export const MAX_LOG_EVENT_LENGTH = 64;
/** Maximum length of a log title. */
export const MAX_LOG_TITLE_LENGTH = 200;
/** Maximum length of a log description. */
export const MAX_LOG_DESCRIPTION_LENGTH = 2000;
/** Maximum length of a log icon (one or two emoji). */
export const MAX_LOG_ICON_LENGTH = 16;
/** Maximum number of props on one log. */
export const MAX_LOG_PROPS = 40;
/** Maximum length of a prop key. */
export const MAX_LOG_PROP_KEY_LENGTH = 64;
/** Maximum length of a string prop value. */
export const MAX_LOG_PROP_VALUE_LENGTH = 500;
/** Logs older than this are queued for deletion. */
export const LOG_RETENTION_DAYS = 30;
export const DEFAULT_LOG_QUERY_LIMIT = 100;
export const MAX_LOG_QUERY_LIMIT = 500;

/** Lowercase dotted or dashed event names: `signup`, `waitlist.join`, `payment:failed`. */
export const LOG_EVENT_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;

const uuidV4 = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'uuid v4');

const optionalText = (max: number) => z.string().trim().min(1).max(max).optional();

export const LogLevelField = z.enum(LOG_LEVELS);

export const LogPropValue = z.union([
  z.string().max(MAX_LOG_PROP_VALUE_LENGTH),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
export type LogPropValue = z.infer<typeof LogPropValue>;

export const LogProps = z
  .record(z.string().min(1).max(MAX_LOG_PROP_KEY_LENGTH), LogPropValue)
  .refine((props) => Object.keys(props).length <= MAX_LOG_PROPS, {
    message: `at most ${MAX_LOG_PROPS} props`,
  });
export type LogProps = z.infer<typeof LogProps>;

/** One owner-authored application log. */
export const LogEventV1 = z
  .object({
    log_id: uuidV4,
    timestamp: z.number().int().min(0),
    event: z.string().regex(LOG_EVENT_PATTERN, 'lowercase event name'),
    level: LogLevelField.default('info'),
    title: optionalText(MAX_LOG_TITLE_LENGTH),
    description: optionalText(MAX_LOG_DESCRIPTION_LENGTH),
    icon: optionalText(MAX_LOG_ICON_LENGTH),
    props: LogProps.default({}),
  })
  .strict();
export type LogEventV1 = z.infer<typeof LogEventV1>;

/** V1 log batch sent by an SDK or drop-in client. */
export const LogBatchV1 = z
  .object({
    batch_id: uuidV4.optional(),
    schema_version: z.literal(SCHEMA_VERSION),
    environment: EnvironmentName.optional(),
    logs: z.array(LogEventV1).min(1).max(MAX_LOG_BATCH),
  })
  .strict();
export type LogBatchV1 = z.infer<typeof LogBatchV1>;

export type LogBatchValidation = { ok: true; batch: LogBatchV1 } | { ok: false; errors: string[] };

export function validateLogBatch(input: unknown): LogBatchValidation {
  const parsed = LogBatchV1.safeParse(input);
  if (parsed.success) return { ok: true, batch: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || '$'}: ${issue.message}`),
  };
}

/** True when `level` is at or above `minimum` in severity. */
export function logLevelAtLeast(level: LogLevel, minimum: LogLevel): boolean {
  return LOG_LEVELS.indexOf(level) >= LOG_LEVELS.indexOf(minimum);
}

export const LogQueryRequestV1 = z
  .object({
    app_id: z.string().min(1),
    environment_id: z.string().min(1),
    /** Minimum level, inclusive. */
    level: LogLevelField.default('debug'),
    event: z.string().regex(LOG_EVENT_PATTERN).optional(),
    limit: z.number().int().min(1).max(MAX_LOG_QUERY_LIMIT).default(DEFAULT_LOG_QUERY_LIMIT),
  })
  .strict();
export type LogQueryRequestV1 = z.infer<typeof LogQueryRequestV1>;

export const LogQueryResponseV1 = z.object({
  refreshed_at: z.number().int().min(0),
  level: LogLevelField,
  retention_days: z.literal(LOG_RETENTION_DAYS),
  limit: z.number().int().min(1).max(MAX_LOG_QUERY_LIMIT),
  logs: z.array(LogEventV1),
});
export type LogQueryResponseV1 = z.infer<typeof LogQueryResponseV1>;
