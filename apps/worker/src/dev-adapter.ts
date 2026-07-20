// Credential-free in-memory development adapter for the V0 worker.
// Wave 0 only serves seeded endpoint metrics and a fixed installation-status
// response. Wave 1 will add ingest, key verification, and aggregation against
// this same adapter interface.

import {
  InstallationStatusV1,
  type AppV1,
  type CreateAppRequestV1,
  type CreateAppResponseV1,
  type EnvironmentV1,
  type EndpointQueryResponseV1,
  type InstallationStatusV1 as InstallationStatus,
  type KeyDisplayV1,
  type Window,
} from '@app-health/contracts';
import {
  SEED_APP_ID,
  SEED_APP_NAME,
  SEED_ENV_ID,
  SEED_ENV_NAME,
  SEED_KEY,
  buildSeedBuckets,
  mergeBuckets,
} from '@app-health/contracts';

/**
 * In-memory adapter interface. The Cloudflare D1 implementation (Wave 1) will
 * implement the same shape; tests and the worker route layer depend only on
 * this interface.
 */
export interface AppHealthAdapter {
  createApp(request: CreateAppRequestV1): Promise<CreateAppResponseV1>;
  installationStatus(appId: string, envId: string): Promise<InstallationStatus>;
  queryEndpoints(appId: string, envId: string, window: Window): Promise<EndpointQueryResponseV1>;
}

/** Seeded app/environment used by the dev adapter. */
const SEED_APP: AppV1 = {
  id: SEED_APP_ID,
  name: SEED_APP_NAME,
  created_at: 1_725_000_000_000,
};

const SEED_ENV: EnvironmentV1 = {
  id: SEED_ENV_ID,
  app_id: SEED_APP_ID,
  name: SEED_ENV_NAME,
  created_at: SEED_APP.created_at,
};

/**
 * In-memory dev adapter. No credentials, no D1, no production resources.
 * App creation always returns the seeded app/key so the dashboard has a
 * stable demo surface; the key is clearly marked as non-production.
 */
export class InMemoryDevAdapter implements AppHealthAdapter {
  async createApp(_request: CreateAppRequestV1): Promise<CreateAppResponseV1> {
    const keyDisplay: KeyDisplayV1 = {
      key: SEED_KEY,
      app_id: SEED_APP.id,
      environment_id: SEED_ENV.id,
      created_at: SEED_APP.created_at,
    };
    return { app: SEED_APP, environment: SEED_ENV, key: keyDisplay };
  }

  async installationStatus(appId: string, envId: string): Promise<InstallationStatus> {
    if (appId !== SEED_APP_ID || envId !== SEED_ENV_ID) {
      return InstallationStatusV1.parse({
        state: 'waiting',
        first_seen: null,
        last_seen: null,
        next_action: 'Install the SDK with this environment\u2019s ingest key.',
      });
    }
    const now = Date.now();
    return InstallationStatusV1.parse({
      state: 'connected',
      runtime: 'node',
      first_seen: now - 10 * 60_000,
      last_seen: now - 60_000,
      next_action: 'Send traffic to your instrumented endpoints to populate the dashboard.',
    });
  }

  async queryEndpoints(
    appId: string,
    envId: string,
    window: Window,
  ): Promise<EndpointQueryResponseV1> {
    if (appId !== SEED_APP_ID || envId !== SEED_ENV_ID) {
      return { refreshed_at: Date.now(), window, endpoints: [] };
    }
    const refreshedAt = Date.now();
    return {
      refreshed_at: refreshedAt,
      window,
      endpoints: mergeBuckets(buildSeedBuckets(refreshedAt), window, refreshedAt),
    };
  }
}
