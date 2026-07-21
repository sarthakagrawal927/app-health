// Express middleware for @saas-maker/app-health/express.
//
// Captures method, framework route template (Express `baseUrl + route.path`
// after the response completes), status code, integer duration, timestamp,
// and optional release. Falls back to conservative numeric/UUID path
// normalization when no Express route matched (e.g. 404s).
//
// Privacy: the middleware reads only `req.method`, `req.baseUrl`,
// `req.route.path`, `req.path`, and `res.statusCode`. It never reads headers,
// cookies, query values, route parameter values, request or response bodies,
// user identity, logs, stacks, or spans.
//
// The application response never awaits ingest. `record()` is non-blocking.

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { AppHealthClient } from './client.js';
import {
  normalizeMethod,
  normalizeRelease,
  normalizeRoutePath,
  normalizeStatus,
} from './normalize.js';

export interface ExpressMiddlewareOptions {
  client: AppHealthClient;
  /** Override the client's release for events emitted by this middleware. */
  release?: string;
  /**
   * Optional hook invoked after each completed request with the normalized
   * event fields. Useful for tests; never sent to ingest.
   */
  onRecord?: (event: {
    method: string;
    route: string;
    status_code: number;
    duration_ms: number;
  }) => void;
}

/**
 * Create Express middleware that records one endpoint summary per completed
 * request. The middleware calls `next()` immediately and records on the
 * `res.on('finish')` event, so it never delays the response.
 */
export function expressMiddleware(options: ExpressMiddlewareOptions): RequestHandler {
  const { client, onRecord } = options;
  const release = normalizeRelease(options.release);
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = nowMs();
    // `finish` fires after the response has been sent to the OS socket.
    res.on('finish', () => {
      const durationMs = Math.max(0, Math.round(nowMs() - start));
      const route = resolveExpressRoute(req);
      const method = normalizeMethod(req.method);
      const status = normalizeStatus(res.statusCode);
      if (method === null || route === null || status === null) return;
      onRecord?.({ method, route, status_code: status, duration_ms: durationMs });
      client.record({
        method,
        route,
        status_code: status,
        duration_ms: durationMs,
        ...(release !== undefined ? { release } : {}),
      });
    });
    next();
  };
}

/**
 * Resolve the route template for a completed Express request.
 * Prefers `req.baseUrl + req.route.path` (the framework-native template).
 * Falls back to conservative concrete-path normalization when no route
 * matched (404) or `req.route` is unavailable.
 */
function resolveExpressRoute(req: Request): string | null {
  const routePath = req.route?.path;
  if (typeof routePath === 'string' && routePath.length > 0) {
    const base = typeof req.baseUrl === 'string' ? req.baseUrl : '';
    const combined = `${base}${routePath}`;
    return normalizeRoutePath(combined);
  }
  const path = typeof req.path === 'string' ? req.path : req.url;
  return normalizeRoutePath(path);
}

function nowMs(): number {
  // `performance.now()` is monotonic and available on Node 20+.
  const perf = globalThis.performance;
  if (perf && typeof perf.now === 'function') return perf.now();
  return Date.now();
}
