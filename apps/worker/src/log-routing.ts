// Per-deployment log routing. LOG_ROUTES (JSON, see LogRoutesV1) decides which
// sinks each log reaches. Without it, the defaults store everything and alert
// server logs at LOG_ALERT_MIN_LEVEL (default info) and browser logs at error.
// `store` is applied at ingest; every other sink is delivered here, after the
// response, so a slow destination never slows the sending app.

import {
  LogLevelField,
  LogRoutesV1,
  defaultLogRoutes,
  type LogRoutesV1 as LogRoutes,
  type StoredLogV1,
} from '@app-health/contracts';
import { deliverLogAlerts, type LogAlertContext } from './log-alerts.js';

export interface RoutingEnv {
  LOG_ROUTES?: string;
  LOG_ALERT_MIN_LEVEL?: string;
  LOG_ALERT_WEBHOOK_URL?: string;
}

/** Parse LOG_ROUTES, falling back to the defaults (and logging) when it is missing or invalid. */
export function resolveLogRoutes(env: RoutingEnv): LogRoutes {
  const alertLevel = LogLevelField.safeParse(env.LOG_ALERT_MIN_LEVEL);
  const fallback = defaultLogRoutes(alertLevel.success ? alertLevel.data : 'info');
  if (!env.LOG_ROUTES) return fallback;
  try {
    const parsed = LogRoutesV1.safeParse(JSON.parse(env.LOG_ROUTES));
    if (parsed.success) return parsed.data;
    console.error(
      JSON.stringify({ msg: 'LOG_ROUTES invalid, using defaults', issues: parsed.error.issues }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({ msg: 'LOG_ROUTES is not JSON, using defaults', error: String(error) }),
    );
  }
  return fallback;
}

export type SinkBatches = Partial<Record<'store' | 'slack', StoredLogV1[]>>;

/** Deliver every non-store sink. Returns the number of logs handed to external sinks. */
export async function deliverSinks(
  sinks: SinkBatches,
  context: LogAlertContext,
  env: RoutingEnv,
): Promise<number> {
  let delivered = 0;
  if (sinks.slack && env.LOG_ALERT_WEBHOOK_URL) {
    delivered += await deliverLogAlerts(sinks.slack, {
      ...context,
      webhookUrl: env.LOG_ALERT_WEBHOOK_URL,
      minLevel: 'debug',
    });
  }
  return delivered;
}
