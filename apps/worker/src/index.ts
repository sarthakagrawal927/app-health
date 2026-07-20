// V0 Cloudflare Worker entry point.
// Routes:
//   GET  /v1/health                       -> liveness probe (no auth)
//   POST /v1/apps                         -> local-only app creation (owner auth)
//   POST /v1/apps/:app_id/environments/:env_id/revoke -> revoke key (owner auth)
//   GET  /v1/installation/status          -> installation status (owner auth)
//   GET  /v1/endpoints                    -> observed endpoint aggregates (owner auth)
//   POST /v1/ingest                       -> authenticated v1 batch ingest
//
// Owner APIs fail closed outside local mode (no identity adapter configured).
// Ingest authenticates the environment-scoped key independently of owner auth.
// V0 runs against the in-memory adapter; D1, deploy, and production auth are
// explicitly out of scope.

import {
  CreateAppRequestV1,
  EndpointQueryRequestV1,
  InstallationStatusV1,
  WINDOWS,
  type Window,
} from '@app-health/contracts';
import { InMemoryAdapter } from './in-memory-adapter.js';
import type { AppHealthRepositories } from './repository.js';
import { LocalOwnerIdentityAdapter } from './identity.js';
import type { OwnerIdentityAdapter } from './identity.js';
import { AppHealthService } from './service.js';

export interface Env {
  /** 'local' enables the in-memory dev adapter and local owner identity. */
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

interface AdapterBundle {
  repos: AppHealthRepositories;
  service: AppHealthService;
  identity: OwnerIdentityAdapter;
}

// The in-memory adapter is async-initialized (SHA-256 seed verifier). Cache one
// instance per worker isolate so the seeded demo data is stable across requests
// within the same local session.
let cachedAdapter: AdapterBundle | null = null;

async function resolveAdapter(env: Env): Promise<AdapterBundle | null> {
  if (env.APP_HEALTH_MODE !== 'local') {
    // Non-local execution without a configured production identity fails closed.
    return null;
  }
  if (!cachedAdapter) {
    const adapter = await InMemoryAdapter.create();
    const repos = adapter.asRepositories();
    const service = new AppHealthService(repos);
    const identity = new LocalOwnerIdentityAdapter();
    cachedAdapter = { repos, service, identity };
  }
  return cachedAdapter;
}

function extractBearerKey(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return '';
  return match[1].trim();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/v1/health') {
      return json(200, { ok: true });
    }

    const adapter = await resolveAdapter(env);
    if (adapter === null) {
      return unauthorized('owner APIs fail closed outside local mode');
    }
    const { service, identity } = adapter;

    // Ingest authenticates via the ingest key, independent of owner identity.
    if (url.pathname === '/v1/ingest') {
      if (request.method !== 'POST') return json(405, { error: 'method not allowed' });
      const rawKey = extractBearerKey(request);
      const body = (await request.json().catch(() => null)) as unknown;
      const result = await service.ingest(rawKey, body, Date.now());
      if (!result.ok) return json(result.status, { error: result.error });
      return json(202, { accepted: result.accepted, duplicates: result.duplicates });
    }

    // All other routes are owner APIs and require a resolved owner identity.
    const owner = identity.resolve();
    if (!owner) {
      return unauthorized('owner identity required');
    }

    if (url.pathname === '/v1/apps') {
      if (request.method !== 'POST') return json(405, { error: 'method not allowed' });
      const body = (await request.json().catch(() => null)) as unknown;
      const parsed = CreateAppRequestV1.safeParse(body);
      if (!parsed.success) return badRequest('invalid app creation request');
      const created = await service.createApp(parsed.data, Date.now());
      return json(201, created);
    }

    const revokeMatch = url.pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/revoke$/);
    if (revokeMatch) {
      if (request.method !== 'POST') return json(405, { error: 'method not allowed' });
      const [, appId, envId] = revokeMatch;
      const keyRecord = await adapter.repos.keys.getActiveKeyForEnvironment(appId, envId);
      if (!keyRecord) return json(404, { error: 'no active key for environment' });
      await service.revokeKey(keyRecord.id, Date.now());
      return json(200, { revoked: true, key_id: keyRecord.id });
    }

    if (url.pathname === '/v1/installation/status') {
      if (request.method !== 'GET') return json(405, { error: 'method not allowed' });
      const appId = url.searchParams.get('app_id');
      const envId = url.searchParams.get('environment_id');
      if (!appId || !envId) return badRequest('app_id and environment_id are required');
      const status = await service.installationStatus(appId, envId, Date.now());
      return json(200, InstallationStatusV1.parse(status));
    }

    if (url.pathname === '/v1/endpoints') {
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
      const response = await service.queryEndpoints(appId, envId, windowParam, Date.now());
      return json(200, response);
    }

    return json(404, { error: 'not found' });
  },
};

// Re-export for tests.
export { InMemoryAdapter, AppHealthService };
export type { AppHealthRepositories, OwnerIdentityAdapter };
