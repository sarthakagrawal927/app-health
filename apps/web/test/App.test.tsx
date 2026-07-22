import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App, OwnerUnlock, sortEndpoints } from '../src/App.js';
import type {
  EndpointAggregateV1,
  FailureEventV1,
  InstallationStatusV1,
} from '@app-health/contracts';

const STORAGE_KEY = 'app-health-v0-project';
const storageValues = new Map<string, string>();
const storage = {
  getItem: (key: string) => storageValues.get(key) ?? null,
  setItem: (key: string, value: string) => storageValues.set(key, value),
  removeItem: (key: string) => storageValues.delete(key),
  clear: () => storageValues.clear(),
  key: (index: number) => [...storageValues.keys()][index] ?? null,
  get length() {
    return storageValues.size;
  },
};
const savedProject = {
  appId: 'app-test',
  environmentId: 'env-test',
  name: 'checkout-api',
  environment: 'production',
};

const endpoints: EndpointAggregateV1[] = [
  {
    method: 'POST',
    route: '/orders',
    request_count: 260,
    error_count: 18,
    error_rate: 18 / 260,
    p50_ms: 180,
    p95_ms: 2400,
    last_seen: Date.now() - 8_000,
    health_state: 'unhealthy',
  },
  {
    method: 'GET',
    route: '/health',
    request_count: 18,
    error_count: 0,
    error_rate: 0,
    p50_ms: 8,
    p95_ms: 18,
    last_seen: Date.now() - 20_000,
    health_state: 'insufficient-data',
  },
];

const connected: InstallationStatusV1 = {
  state: 'connected',
  runtime: 'node',
  first_seen: Date.now() - 60_000,
  last_seen: Date.now() - 8_000,
  next_action: 'Endpoint summaries are arriving.',
};

function installFetch(options?: {
  status?: InstallationStatusV1;
  endpointRows?: EndpointAggregateV1[];
  failureRows?: FailureEventV1[];
  failureFail?: boolean;
  fail?: boolean;
}) {
  const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
    if (options?.fail) throw new Error('connection refused');
    const url =
      input instanceof URL ? input : new URL(typeof input === 'string' ? input : input.url);
    if (url.pathname === '/v1/apps') {
      return new Response(
        JSON.stringify({
          app: { id: 'app-new', name: 'orders-api', created_at: Date.now() },
          environment: {
            id: 'env-new',
            app_id: 'app-new',
            name: 'production',
            created_at: Date.now(),
          },
          key: {
            key: 'ahk_one_time_secret',
            app_id: 'app-new',
            environment_id: 'env-new',
            created_at: Date.now(),
          },
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      );
    }
    if (url.pathname === '/v1/installation/status') {
      return Response.json(options?.status ?? connected);
    }
    if (url.pathname === '/v1/endpoints') {
      return Response.json({
        refreshed_at: Date.now(),
        window: url.searchParams.get('window') ?? '15m',
        endpoints: options?.endpointRows ?? endpoints,
      });
    }
    if (url.pathname === '/v1/failures') {
      if (options?.failureFail) return new Response(null, { status: 503 });
      return Response.json({
        refreshed_at: Date.now(),
        retention_hours: 24,
        limit: Number(url.searchParams.get('limit') ?? 50),
        failures: options?.failureRows ?? [],
      });
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('App Health V0 UI', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage);
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unlocks with an owner key without persisting it in browser storage', async () => {
    const onUnlock = vi.fn();
    const fetchMock = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer aho_owner-secret');
      return Response.json({ apps: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<OwnerUnlock onUnlock={onUnlock} />);
    const input = screen.getByLabelText('Owner key');
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.change(input, { target: { value: 'aho_owner-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(onUnlock).toHaveBeenCalledWith('aho_owner-secret'));
    expect([...storageValues.values()].join('')).not.toContain('aho_owner-secret');
  });

  it('starts with the focused project setup flow', () => {
    installFetch();
    render(<App />);
    expect(screen.getByRole('heading', { name: /know which routes are healthy/i })).toBeTruthy();
    expect(screen.getByLabelText('Application name')).toBeTruthy();
    expect(screen.getByText(/no payload storage/i)).toBeTruthy();
  });

  it('shows a newly-created key once and never persists the raw key', async () => {
    installFetch({
      status: {
        state: 'waiting',
        first_seen: null,
        last_seen: null,
        next_action: 'Start your service.',
      },
      endpointRows: [],
    });
    render(<App />);
    fireEvent.change(screen.getByLabelText('Application name'), {
      target: { value: 'orders-api' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    expect(await screen.findByText('ahk_one_time_secret')).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('ahk_one_time_secret');
    fireEvent.click(screen.getByRole('button', { name: /i saved the key/i }));
    expect(await screen.findByText('Waiting for traffic')).toBeTruthy();
    expect(screen.queryByText('ahk_one_time_secret')).toBeNull();
  });

  it('shows copy-ready SDK and OpenTelemetry setup without persisting the key', async () => {
    installFetch();
    render(<App />);
    fireEvent.change(screen.getByLabelText('Application name'), {
      target: { value: 'orders-api' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));

    expect(await screen.findByText(/npm install @saas-maker\/app-health/)).toBeTruthy();
    expect(screen.getByText(/@saas-maker\/app-health\/express/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Go + Echo' }));
    expect(
      screen.getByText(
        /go get github\.com\/sarthakagrawal927\/app-health\/packages\/go\/echo\/v5@v5\.1\.0/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/apphealthechov5\.Install/)).toBeTruthy();
    expect(screen.getByText(/Enabled: true/)).toBeTruthy();
    expect(screen.getByText(/Environment: "production"/)).toBeTruthy();
    expect(screen.getByText(/Project: "orders-api"/)).toBeTruthy();
    expect(screen.queryByText(/IngestURL/)).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Existing OpenTelemetry' }));
    expect(screen.getByText(/otlphttp\/app_health/)).toBeTruthy();
    expect(screen.getByText(/\/v1\/traces/)).toBeTruthy();
    expect(screen.getByText(/Bearer ahk_one_time_secret/)).toBeTruthy();
    expect(screen.getByText(/Reload your Collector/)).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).not.toContain('ahk_one_time_secret');
  });

  it('identifies OpenTelemetry traffic and discloses sampled endpoint estimates', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProject));
    installFetch({
      status: { ...connected, runtime: 'otel' },
      endpointRows: [{ ...endpoints[0], upstream_sampled: true }],
    });
    render(<App />);
    expect(await screen.findByText('OpenTelemetry connected')).toBeTruthy();
    expect(screen.getByText(/OpenTelemetry pipeline/)).toBeTruthy();
    expect(screen.getAllByText('OTel sampled estimate')).toHaveLength(2);
  });

  it('renders populated endpoint metrics and changes windows', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProject));
    const fetchMock = installFetch();
    render(<App />);
    expect(await screen.findAllByText('/orders')).toHaveLength(2);
    expect(screen.getAllByText(/low volume/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: '1h' }));
    await waitFor(() => {
      const endpointCalls = fetchMock.mock.calls
        .map(([input]) => (input instanceof URL ? input : null))
        .filter((url): url is URL => url?.pathname === '/v1/endpoints');
      expect(endpointCalls.at(-1)?.searchParams.get('window')).toBe('1h');
    });
  });

  it('loads retained failures only after the owner opens Data received', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProject));
    const fetchMock = installFetch({
      failureRows: [
        {
          failure_id: '00000000-0000-4000-a000-000000000001',
          method: 'POST',
          route: '/orders/:id',
          status_code: 503,
          duration_ms: 812,
          occurred_at: Date.now() - 4_000,
          release: '2026.07.22',
        },
      ],
    });
    render(<App />);
    await screen.findAllByText('/orders');
    expect(
      fetchMock.mock.calls.some(
        ([input]) => input instanceof URL && input.pathname === '/v1/failures',
      ),
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Data received' }));
    expect(await screen.findByText('/orders/:id')).toBeTruthy();
    expect(screen.getByText('503')).toBeTruthy();
    expect(screen.getByText('812 ms')).toBeTruthy();
    expect(screen.getByText('The complete accepted shape')).toBeTruthy();
    expect(screen.getByText('Request bodies')).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(
        ([input]) => input instanceof URL && input.pathname === '/v1/failures',
      ),
    ).toBe(true);
  });

  it('keeps the collection policy visible when failure details cannot load', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProject));
    installFetch({ failureFail: true });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Data received' }));
    expect(await screen.findByText('Failure details are unavailable')).toBeTruthy();
    expect(screen.getByText('Never collected')).toBeTruthy();
    expect(screen.getByText(/2xx and 3xx requests are folded into counts/i)).toBeTruthy();
  });

  it('shows sampled-out endpoint identities without false zero metrics', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProject));
    installFetch({
      endpointRows: [
        {
          method: 'POST',
          route: '/rare',
          request_count: 0,
          error_count: 0,
          error_rate: 0,
          p50_ms: 0,
          p95_ms: 0,
          last_seen: Date.now(),
          health_state: 'insufficient-data',
          metrics_available: false,
        },
      ],
    });
    render(<App />);
    expect(await screen.findAllByText('/rare')).toHaveLength(2);
    expect(screen.getAllByText('metrics sampled')).toHaveLength(2);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText('0.0%')).toBeNull();
  });

  it('renders the waiting and no-traffic state with a concrete next action', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProject));
    installFetch({
      status: {
        state: 'waiting',
        first_seen: null,
        last_seen: null,
        next_action: 'Start your service.',
      },
      endpointRows: [],
    });
    render(<App />);
    expect(await screen.findByText('Waiting for traffic')).toBeTruthy();
    expect(screen.getByText('No endpoints observed yet')).toBeTruthy();
    expect(screen.getByText(/curl http:\/\/localhost:3000\/health/)).toBeTruthy();
  });

  it('explains stale and revoked installation states', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProject));
    installFetch({
      status: {
        state: 'stale',
        runtime: 'go',
        first_seen: Date.now() - 100_000,
        last_seen: Date.now() - 90_000,
        next_action: 'Restart the service.',
      },
      endpointRows: [],
    });
    const { unmount } = render(<App />);
    expect(await screen.findByText('Traffic has gone quiet')).toBeTruthy();
    unmount();
    installFetch({
      status: {
        state: 'revoked',
        first_seen: null,
        last_seen: null,
        next_action: 'Create a key.',
      },
      endpointRows: [],
    });
    render(<App />);
    expect(await screen.findByText('Ingest key revoked')).toBeTruthy();
  });

  it('shows an actionable API failure without hiding the app shell', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedProject));
    installFetch({ fail: true });
    render(<App />);
    expect(await screen.findByText('Can’t refresh endpoint data')).toBeTruthy();
    expect(screen.getByText(/application is unaffected/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('sortEndpoints', () => {
  it('sorts stably across requests, health, error, p95, and last seen', () => {
    expect(sortEndpoints(endpoints, 'requests', 'desc')[0].route).toBe('/orders');
    expect(sortEndpoints(endpoints, 'health', 'desc')[0].health_state).toBe('unhealthy');
    expect(sortEndpoints(endpoints, 'error_rate', 'asc')[0].route).toBe('/health');
    expect(sortEndpoints(endpoints, 'p95', 'desc')[0].p95_ms).toBe(2400);
    expect(sortEndpoints(endpoints, 'last_seen', 'desc')[0].route).toBe('/orders');
  });

  it('keeps endpoints without sampled metrics below measured endpoints', () => {
    const sampledOut = { ...endpoints[0], route: '/rare', metrics_available: false };
    expect(sortEndpoints([sampledOut, ...endpoints], 'requests', 'asc').at(-1)?.route).toBe(
      '/rare',
    );
  });
});
