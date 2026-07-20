// V0 Cloudflare Worker entry point.
// Routes:
//   GET  /v1/health                       -> liveness probe
//   GET  /v1/installation/status          -> installation status (seeded)
//   GET  /v1/endpoints                    -> observed endpoint aggregate (seeded)
//   POST /v1/apps                         -> local-only app creation (seeded)
//   POST /v1/ingest                       -> 501 until Wave 1 implements ingest
//
// All V0 responses are served by the credential-free in-memory dev adapter.
// Production auth, D1, R2, Queues, and deploy are explicitly out of scope.

import {
  CreateAppRequestV1,
  EndpointQueryRequestV1,
  InstallationStatusV1,
  WINDOWS,
  type Window,
} from '@app-health/contracts';
import { InMemoryDevAdapter } from './dev-adapter.js';
import type { AppHealthAdapter } from './dev-adapter.js';

export interface Env {
  /** 'local' enables the in-memory dev adapter. Other values fail closed. */
  APP_HEALTH_MODE?: string;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function badRequest(message: string): Response {
  return json(400, { error: message });
}

function unauthorized(message: string): Response {
  return json(403, { error: message });
}

function resolveAdapter(env: Env): AppHealthAdapter | null {
  if (env.APP_HEALTH_MODE === 'local') {
    return new InMemoryDevAdapter();
  }
  // Non-local execution without a configured production identity fails closed.
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const adapter = resolveAdapter(env);

    if (url.pathname === '/v1/health') {
      return json(200, { ok: true });
    }

    if (adapter === null) {
      return unauthorized('owner APIs fail closed outside local mode');
    }

    switch (url.pathname) {
      case '/v1/installation/status': {
        if (request.method !== 'GET') return json(405, { error: 'method not allowed' });
        const appId = url.searchParams.get('app_id');
        const envId = url.searchParams.get('environment_id');
        if (!appId || !envId) return badRequest('app_id and environment_id are required');
        const status = await adapter.installationStatus(appId, envId);
        return json(200, InstallationStatusV1.parse(status));
      }
      case '/v1/endpoints': {
        if (request.method !== 'GET') return json(405, { error: 'method not allowed' });
        const windowParam = (url.searchParams.get('window') ?? '15m') as Window;
        if (!WINDOWS.includes(windowParam)) return badRequest('unsupported window');
        const appId = url.searchParams.get('app_id');
        const envId = url.searchParams.get('environment_id');
        if (!appId || !envId) return badRequest('app_id and environment_id are required');
        const sort = url.searchParams.get('sort') ?? 'health';
        const sortDir = url.searchParams.get('sort_dir') ?? 'desc';
        const parseResult = EndpointQueryRequestV1.safeParse({
          app_id: appId,
          environment_id: envId,
          window: windowParam,
          sort,
          sort_dir: sortDir,
        });
        if (!parseResult.success) return badRequest('invalid query');
        const response = await adapter.queryEndpoints(appId, envId, windowParam);
        return json(200, response);
      }
      case '/v1/apps': {
        if (request.method !== 'POST') return json(405, { error: 'method not allowed' });
        const body = (await request.json().catch(() => null)) as unknown;
        const parsed = CreateAppRequestV1.safeParse(body);
        if (!parsed.success) return badRequest('invalid app creation request');
        const created = await adapter.createApp(parsed.data);
        return json(201, created);
      }
      case '/v1/ingest': {
        // Wave 1 implements authenticated ingest against the same adapter.
        return json(501, { error: 'ingest not implemented in Wave 0' });
      }
      default:
        return json(404, { error: 'not found' });
    }
  },
};
