import { describe, expect, it } from 'vitest';
import worker, { type Env } from '../src/index.js';
import {
  SEED_APP_ID,
  SEED_ENV_ID,
  SEED_KEY,
  SEED_APP_NAME,
  SEED_ENV_NAME,
} from '@app-health/contracts';

const LOCAL_ENV: Env = { APP_HEALTH_MODE: 'local' };
const NON_LOCAL_ENV: Env = {};

async function call(
  method: string,
  path: string,
  env: Env,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<Response> {
  const init: RequestInit = {
    method,
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  const url = new URL(`https://worker.local${path}`);
  return worker.fetch(new Request(url, init), env);
}

describe('worker /v1/health', () => {
  it('returns ok regardless of mode', async () => {
    const res = await call('GET', '/v1/health', NON_LOCAL_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

describe('worker owner APIs fail closed outside local mode', () => {
  it('rejects /v1/apps outside local mode', async () => {
    const res = await call('POST', '/v1/apps', NON_LOCAL_ENV, {
      name: 'x',
      environment: 'prod',
    });
    expect(res.status).toBe(403);
  });

  it('rejects /v1/endpoints outside local mode', async () => {
    const res = await call(
      'GET',
      `/v1/endpoints?app_id=${SEED_APP_ID}&environment_id=${SEED_ENV_ID}&window=15m`,
      NON_LOCAL_ENV,
    );
    expect(res.status).toBe(403);
  });
});

describe('worker local mode', () => {
  it('creates the seeded app and returns the one-time key', async () => {
    const res = await call('POST', '/v1/apps', LOCAL_ENV, {
      name: SEED_APP_NAME,
      environment: SEED_ENV_NAME,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      app: { id: string; name: string };
      environment: { id: string; name: string };
      key: { key: string };
    };
    expect(body.app.id).toBe(SEED_APP_ID);
    expect(body.environment.id).toBe(SEED_ENV_ID);
    expect(body.key.key).toBe(SEED_KEY);
  });

  it('rejects invalid app creation body', async () => {
    const res = await call('POST', '/v1/apps', LOCAL_ENV, { name: '', environment: '' });
    expect(res.status).toBe(400);
  });

  it('returns connected installation status for the seeded app', async () => {
    const res = await call(
      'GET',
      `/v1/installation/status?app_id=${SEED_APP_ID}&environment_id=${SEED_ENV_ID}`,
      LOCAL_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { state: string };
    expect(body.state).toBe('connected');
  });

  it('returns waiting installation status for an unknown app', async () => {
    const res = await call(
      'GET',
      `/v1/installation/status?app_id=other&environment_id=other`,
      LOCAL_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { state: string };
    expect(body.state).toBe('waiting');
  });

  it('returns seeded endpoint aggregates', async () => {
    const res = await call(
      'GET',
      `/v1/endpoints?app_id=${SEED_APP_ID}&environment_id=${SEED_ENV_ID}&window=15m`,
      LOCAL_ENV,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { endpoints: { method: string; route: string }[] };
    expect(body.endpoints.length).toBeGreaterThan(0);
  });

  it('rejects an unsupported window', async () => {
    const res = await call(
      'GET',
      `/v1/endpoints?app_id=${SEED_APP_ID}&environment_id=${SEED_ENV_ID}&window=99m`,
      LOCAL_ENV,
    );
    expect(res.status).toBe(400);
  });

  it('returns 501 for ingest in Wave 0', async () => {
    const res = await call('POST', '/v1/ingest', LOCAL_ENV, { schema_version: 'v1', events: [] });
    expect(res.status).toBe(501);
  });

  it('returns 404 for unknown paths', async () => {
    const res = await call('GET', '/unknown', LOCAL_ENV);
    expect(res.status).toBe(404);
  });
});
