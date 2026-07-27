import {
  CreateAppRequestV1,
  DEFAULT_FAILURE_QUERY_LIMIT,
  EndpointQueryRequestV1,
  FailureQueryRequestV1,
  InstallationStatusV1,
  ListAppsResponseV1,
  WINDOWS,
  type Window,
} from '@app-health/contracts';
import {
  AnalyticsEngineBuckets,
  createAnalyticsQuery,
  type AnalyticsEngineDatasetLike,
} from './analytics-engine.js';
import { D1ControlPlane, type D1DatabaseLike } from './d1-adapter.js';
import { InMemoryAdapter, DEDUPE_WINDOW_MS } from './in-memory-adapter.js';
import type { AppHealthRepositories } from './repository.js';
import {
  BearerOwnerIdentityAdapter,
  LocalOwnerIdentityAdapter,
  type OwnerIdentityAdapter,
} from './identity.js';
import { AppHealthService } from './service.js';
import { InvalidOtlpError, otlpSuccessBody, projectOtlpTraces } from './otlp.js';

const MAX_BODY_BYTES = 256 * 1024;
const MAX_OTLP_BODY_BYTES = 1024 * 1024;

export interface Env {
  APP_HEALTH_MODE?: string;
  APP_HEALTH_DASHBOARD_HOST?: string;
  APP_HEALTH_INGEST_HOST?: string;
  APP_HEALTH_INGEST_ORIGIN?: string;
  OWNER_AUTH_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  ANALYTICS_ENGINE_QUERY_TOKEN?: string;
  DB?: D1DatabaseLike;
  TELEMETRY?: AnalyticsEngineDatasetLike;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

function json(status: number, body: unknown, noStore = false): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json; charset=utf-8' };
  if (noStore) headers['cache-control'] = 'no-store';
  return new Response(JSON.stringify(body), { status, headers });
}

interface AdapterBundle {
  repos: AppHealthRepositories;
  service: AppHealthService;
  identity: OwnerIdentityAdapter;
  local: boolean;
}

let cachedLocalAdapter: AdapterBundle | null = null;

async function resolveAdapter(env: Env): Promise<AdapterBundle | null> {
  if (env.APP_HEALTH_MODE === 'local') {
    if (!cachedLocalAdapter) {
      const adapter = await InMemoryAdapter.create();
      const repos = adapter.asRepositories();
      cachedLocalAdapter = {
        repos,
        service: new AppHealthService(repos),
        identity: new LocalOwnerIdentityAdapter(),
        local: true,
      };
    }
    return cachedLocalAdapter;
  }
  if (
    !env.DB ||
    !env.TELEMETRY ||
    !env.OWNER_AUTH_TOKEN ||
    !env.CLOUDFLARE_ACCOUNT_ID ||
    !env.ANALYTICS_ENGINE_QUERY_TOKEN ||
    !env.APP_HEALTH_DASHBOARD_HOST ||
    !env.APP_HEALTH_INGEST_HOST ||
    !env.APP_HEALTH_INGEST_ORIGIN
  )
    return null;
  const buckets = new AnalyticsEngineBuckets(
    env.TELEMETRY,
    createAnalyticsQuery({
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      token: env.ANALYTICS_ENGINE_QUERY_TOKEN,
    }),
  );
  const control = new D1ControlPlane(env.DB);
  const repos = control.asRepositories(buckets);
  return {
    repos,
    service: new AppHealthService(repos),
    identity: new BearerOwnerIdentityAdapter(env.OWNER_AUTH_TOKEN, repos.keys),
    local: false,
  };
}

function extractBearerKey(request: Request): string {
  return (
    request.headers
      .get('authorization')
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() ?? ''
  );
}

function ownerCanAccessApp(owner: { appId?: string }, appId: string): boolean {
  return owner.appId === undefined || owner.appId === appId;
}

function productScopeForbidden(): Response {
  return json(403, { error: 'product scope forbids this operation' }, true);
}

async function readJsonBounded(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new BodyTooLargeError();
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_BODY_BYTES) throw new BodyTooLargeError();
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

async function readStreamBounded(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
): Promise<Uint8Array> {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readOtlpBodyBounded(request: Request): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_OTLP_BODY_BYTES) throw new BodyTooLargeError();
  const encoded = await readStreamBounded(request.body, MAX_OTLP_BODY_BYTES);
  const encoding = request.headers.get('content-encoding')?.trim().toLowerCase();
  if (!encoding || encoding === 'identity') return encoded;
  if (encoding !== 'gzip') throw new UnsupportedEncodingError();
  try {
    const decompressed = new Blob([encoded])
      .stream()
      .pipeThrough(new DecompressionStream('gzip')) as ReadableStream<Uint8Array>;
    return await readStreamBounded(decompressed, MAX_OTLP_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) throw error;
    throw new InvalidOtlpError('invalid gzip-compressed OTLP body');
  }
}

function otlpContentType(request: Request): 'protobuf' | 'json' | null {
  const value = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (value === 'application/x-protobuf' || value === 'application/protobuf') return 'protobuf';
  if (value === 'application/json') return 'json';
  return null;
}

class BodyTooLargeError extends Error {}
class UnsupportedEncodingError extends Error {}

function hostAllowed(url: URL, bundle: AdapterBundle, env: Env, kind: 'owner' | 'ingest'): boolean {
  if (bundle.local) return true;
  if (url.hostname.endsWith('.workers.dev')) return false;
  return (
    url.hostname === (kind === 'owner' ? env.APP_HEALTH_DASHBOARD_HOST : env.APP_HEALTH_INGEST_HOST)
  );
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/v1/health') return json(200, { ok: true });

    const bundle = await resolveAdapter(env);
    if (!bundle) return json(503, { error: 'production bindings are incomplete' }, true);
    const { service, identity } = bundle;

    if (url.pathname === '/v1/ingest') {
      if (!hostAllowed(url, bundle, env, 'ingest')) return json(404, { error: 'not found' });
      if (request.method !== 'POST') return json(405, { error: 'method not allowed' });
      try {
        const result = await service.ingest(
          extractBearerKey(request),
          await readJsonBounded(request),
          Date.now(),
        );
        if (!result.ok) return json(result.status, { error: result.error });
        return json(202, { accepted: result.accepted, duplicates: result.duplicates });
      } catch (error) {
        if (error instanceof BodyTooLargeError)
          return json(413, { error: 'request body too large' });
        throw error;
      }
    }

    if (url.pathname === '/v1/traces') {
      if (!hostAllowed(url, bundle, env, 'ingest')) return json(404, { error: 'not found' });
      if (request.method !== 'POST') return json(405, { error: 'method not allowed' });
      const contentType = otlpContentType(request);
      if (!contentType) return json(415, { error: 'unsupported OTLP content type' });
      const keyRecord = await service.verifyIngestKey(extractBearerKey(request));
      if (!keyRecord) return json(401, { error: 'invalid or revoked ingest key' });
      try {
        const projection = await projectOtlpTraces(await readOtlpBodyBounded(request), contentType);
        const result = await service.ingestEvents(
          keyRecord,
          'otel',
          undefined,
          projection.events,
          Date.now(),
        );
        if (!result.ok) return json(result.status, { error: result.error });
        const responseType =
          contentType === 'protobuf' ? 'application/x-protobuf' : 'application/json';
        return new Response(otlpSuccessBody(contentType, projection.rejectedSpans), {
          status: 200,
          headers: { 'content-type': responseType },
        });
      } catch (error) {
        if (error instanceof BodyTooLargeError)
          return json(413, { error: 'request body too large' });
        if (error instanceof UnsupportedEncodingError)
          return json(415, { error: 'unsupported content encoding' });
        if (error instanceof InvalidOtlpError) return json(400, { error: error.message });
        throw error;
      }
    }

    if (!hostAllowed(url, bundle, env, 'owner')) return json(404, { error: 'not found' });
    if (!url.pathname.startsWith('/v1/')) {
      if (request.method === 'GET' && env.ASSETS) return env.ASSETS.fetch(request);
      return json(404, { error: 'not found' });
    }

    const owner = await identity.resolve(request);
    if (!owner) return json(403, { error: 'owner secret required' }, true);

    if (url.pathname === '/v1/apps') {
      if (request.method === 'GET')
        return json(200, ListAppsResponseV1.parse(await service.listApps(owner.appId)), true);
      if (request.method !== 'POST') return json(405, { error: 'method not allowed' });
      if (owner.appId) return productScopeForbidden();
      try {
        const parsed = CreateAppRequestV1.safeParse(await readJsonBounded(request));
        if (!parsed.success) return json(400, { error: 'invalid app creation request' }, true);
        return json(201, await service.createApp(parsed.data, Date.now()), true);
      } catch (error) {
        if (error instanceof BodyTooLargeError)
          return json(413, { error: 'request body too large' }, true);
        throw error;
      }
    }

    const revokeMatch = url.pathname.match(/^\/v1\/apps\/([^/]+)\/environments\/([^/]+)\/revoke$/);
    if (revokeMatch) {
      if (request.method !== 'POST') return json(405, { error: 'method not allowed' });
      if (owner.appId) return productScopeForbidden();
      const keyRecord = await bundle.repos.keys.getActiveKeyForEnvironment(
        revokeMatch[1],
        revokeMatch[2],
      );
      if (!keyRecord) return json(404, { error: 'no active key for environment' }, true);
      await service.revokeKey(keyRecord.id, Date.now());
      return json(200, { revoked: true, key_id: keyRecord.id }, true);
    }

    if (url.pathname === '/v1/installation/status') {
      if (request.method !== 'GET') return json(405, { error: 'method not allowed' });
      const appId = url.searchParams.get('app_id');
      const envId = url.searchParams.get('environment_id');
      if (!appId || !envId) return json(400, { error: 'app_id and environment_id are required' });
      if (!ownerCanAccessApp(owner, appId)) return productScopeForbidden();
      return json(
        200,
        InstallationStatusV1.parse(await service.installationStatus(appId, envId, Date.now())),
        true,
      );
    }

    if (url.pathname === '/v1/endpoints') {
      if (request.method !== 'GET') return json(405, { error: 'method not allowed' });
      const windowParam = (url.searchParams.get('window') ?? '15m') as Window;
      const parsed = EndpointQueryRequestV1.safeParse({
        app_id: url.searchParams.get('app_id'),
        environment_id: url.searchParams.get('environment_id'),
        window: WINDOWS.includes(windowParam) ? windowParam : 'invalid',
        sort: url.searchParams.get('sort') ?? 'health',
        sort_dir: url.searchParams.get('sort_dir') ?? 'desc',
      });
      if (!parsed.success) return json(400, { error: 'invalid query' });
      if (!ownerCanAccessApp(owner, parsed.data.app_id)) return productScopeForbidden();
      return json(
        200,
        await service.queryEndpoints(
          parsed.data.app_id,
          parsed.data.environment_id,
          parsed.data.window,
          Date.now(),
        ),
        true,
      );
    }

    if (url.pathname === '/v1/failures') {
      if (request.method !== 'GET') return json(405, { error: 'method not allowed' });
      const parsed = FailureQueryRequestV1.safeParse({
        app_id: url.searchParams.get('app_id'),
        environment_id: url.searchParams.get('environment_id'),
        window: url.searchParams.get('window') ?? undefined,
        limit: Number(url.searchParams.get('limit') ?? DEFAULT_FAILURE_QUERY_LIMIT),
      });
      if (!parsed.success) return json(400, { error: 'invalid failure query' }, true);
      if (!ownerCanAccessApp(owner, parsed.data.app_id)) return productScopeForbidden();
      return json(
        200,
        await service.queryFailures(
          parsed.data.app_id,
          parsed.data.environment_id,
          parsed.data.window,
          parsed.data.limit,
          Date.now(),
        ),
        true,
      );
    }

    return json(404, { error: 'not found' });
  },

  async scheduled(_controller: unknown, env: Env): Promise<void> {
    if (!env.DB) return;
    const control = new D1ControlPlane(env.DB);
    await control.cleanupExpired(Date.now() - DEDUPE_WINDOW_MS, 10_000);
    await control.cleanupFailuresExpired(Date.now() - 24 * 60 * 60 * 1000, 10_000);
  },
};

export default worker;
export { InMemoryAdapter, AppHealthService };
export type { AppHealthRepositories, OwnerIdentityAdapter };
