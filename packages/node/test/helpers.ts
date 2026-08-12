// Test helpers: a controllable fetch fake for deterministic ingest tests.

import type { FetchLike } from '../src/index.js';

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

export interface FetchController {
  fetch: FetchLike;
  requests: CapturedRequest[];
  /** Set the next response(s) to return. Each call consumes one entry. */
  setResponses: (responses: ResponsePlan | ResponsePlan[]) => void;
  /** Number of times fetch was invoked. */
  callCount: () => number;
  /** Reset captured requests and call counter. */
  reset: () => void;
}

type ResponsePlan =
  | { ok: true; status: number; body?: unknown }
  | { ok: false; status?: number; error?: string }
  | { throw: string }
  | { status: number; body?: unknown };

/**
 * Build a fetch fake that records every request and returns scripted
 * responses. Defaults to 202 Accepted.
 */
export function createFetchController(defaultStatus = 202): FetchController {
  const requests: CapturedRequest[] = [];
  let plan: ResponsePlan[] = [];
  let calls = 0;
  const defaults: ResponsePlan = { ok: true, status: defaultStatus };

  const fetch: FetchLike = async (input: unknown, init?: unknown) => {
    const initObj = (init ?? {}) as Record<string, unknown>;
    calls += 1;
    const url = typeof input === 'string' ? input : String(input);
    const headers: Record<string, string> = {};
    const rawHeaders = initObj.headers;
    if (rawHeaders instanceof Headers) {
      rawHeaders.forEach((v: string, k: string) => {
        headers[k] = v;
      });
    } else if (Array.isArray(rawHeaders)) {
      for (const [k, v] of rawHeaders) headers[String(k)] = String(v);
    } else if (rawHeaders && typeof rawHeaders === 'object') {
      for (const [k, v] of Object.entries(rawHeaders)) headers[k] = String(v);
    }
    requests.push({
      url,
      method: String(initObj.method ?? 'GET'),
      headers,
      body: String(initObj.body ?? ''),
    });

    const next = plan.shift() ?? defaults;
    if ('throw' in next) {
      throw new Error(next.throw);
    }
    const status = next.status ?? 200;
    const body = ('body' in next ? next.body : undefined) ?? '';
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };

  return {
    fetch,
    requests,
    setResponses: (responses) => {
      plan = Array.isArray(responses) ? [...responses] : [responses];
    },
    callCount: () => calls,
    reset: () => {
      requests.length = 0;
      calls = 0;
      plan = [];
    },
  };
}
