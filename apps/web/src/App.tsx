import { useEffect, useMemo, useState } from 'react';
import {
  DEGRADED_ERROR_RATE,
  DEGRADED_P95_MS,
  INSUFFICIENT_DATA_MIN_REQUESTS,
  SEED_APP_ID,
  SEED_APP_NAME,
  SEED_ENV_ID,
  SEED_ENV_NAME,
  UNHEALTHY_ERROR_RATE,
  UNHEALTHY_P95_MS,
  WINDOWS,
  type CreateAppResponseV1,
  type EndpointAggregateV1,
  type EndpointQueryResponseV1,
  type InstallationStatusV1,
  type Window,
} from '@app-health/contracts';

const API_BASE = (import.meta.env.VITE_APP_HEALTH_API as string | undefined) ?? '';
const STORAGE_KEY = 'app-health-v0-project';

type SortKey = 'health' | 'requests' | 'error_rate' | 'p95' | 'last_seen';
type SortDirection = 'asc' | 'desc';

interface SavedProject {
  appId: string;
  environmentId: string;
  name: string;
  environment: string;
}

const healthWeight: Record<EndpointAggregateV1['health_state'], number> = {
  unhealthy: 4,
  degraded: 3,
  'insufficient-data': 2,
  healthy: 1,
};

function apiUrl(path: string): URL {
  const base = API_BASE || window.location.origin;
  return new URL(path, base);
}

function readProject(): SavedProject | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SavedProject>;
    if (!value.appId || !value.environmentId || !value.name || !value.environment) return null;
    return value as SavedProject;
  } catch {
    return null;
  }
}

export function sortEndpoints(
  endpoints: EndpointAggregateV1[],
  key: SortKey,
  direction: SortDirection,
): EndpointAggregateV1[] {
  const factor = direction === 'desc' ? -1 : 1;
  return endpoints
    .map((endpoint, index) => ({ endpoint, index }))
    .sort((a, b) => {
      const av =
        key === 'health'
          ? healthWeight[a.endpoint.health_state]
          : key === 'requests'
            ? a.endpoint.request_count
            : key === 'p95'
              ? a.endpoint.p95_ms
              : key === 'error_rate'
                ? a.endpoint.error_rate
                : (a.endpoint.last_seen ?? 0);
      const bv =
        key === 'health'
          ? healthWeight[b.endpoint.health_state]
          : key === 'requests'
            ? b.endpoint.request_count
            : key === 'p95'
              ? b.endpoint.p95_ms
              : key === 'error_rate'
                ? b.endpoint.error_rate
                : (b.endpoint.last_seen ?? 0);
      return av === bv ? a.index - b.index : (av - bv) * factor;
    })
    .map(({ endpoint }) => endpoint);
}

function formatAge(timestamp: number | null): string {
  if (timestamp === null) return 'Never';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function methodClass(method: string): string {
  return `method method-${method.toLowerCase()}`;
}

function Setup({ onCreated }: { onCreated: (created: CreateAppResponseV1) => void }): JSX.Element {
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(apiUrl('/v1/apps'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, environment }),
      });
      if (!response.ok) throw new Error(`Setup API returned ${response.status}`);
      onCreated((await response.json()) as CreateAppResponseV1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the app');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="setup-shell">
      <section className="setup-copy" aria-labelledby="setup-title">
        <div className="eyebrow">
          <span className="signal-dot" /> Endpoint observability, distilled
        </div>
        <h1 id="setup-title">Know which routes are healthy before your users tell you.</h1>
        <p className="setup-lede">
          Add one lightweight middleware to your Node or Go service. App Health turns observed
          requests into a focused view of traffic, latency, and errors—without storing request data.
        </p>
        <div className="trust-list" aria-label="Product guarantees">
          <span>Method + route only</span>
          <span>Fail-open SDKs</span>
          <span>No payload storage</span>
        </div>
      </section>
      <section className="setup-card" aria-label="Create an App Health project">
        <div className="step-label">Step 1 of 2</div>
        <h2>Connect your first service</h2>
        <p>We’ll create a scoped ingest key, then show the exact install snippet.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Application name
            <input
              required
              maxLength={128}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="checkout-api"
              autoFocus
            />
          </label>
          <label>
            Environment
            <input
              required
              maxLength={64}
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
            />
          </label>
          {error ? (
            <div className="inline-error" role="alert">
              <strong>Setup failed.</strong> {error}. Check the local API and try again.
            </div>
          ) : null}
          <button className="primary-button" disabled={submitting || !name.trim()} type="submit">
            {submitting ? 'Creating…' : 'Create project'}
            <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="fine-print">Local V0 · no cloud resources are created</p>
      </section>
    </main>
  );
}

function KeySetup({
  created,
  onDone,
}: {
  created: CreateAppResponseV1;
  onDone: () => void;
}): JSX.Element {
  const [runtime, setRuntime] = useState<'node' | 'go'>('node');
  const [copied, setCopied] = useState<string | null>(null);
  const key = created.key.key;
  const nodeSnippet = `npm install @app-health/node\n\napp.use(appHealth({\n  key: '${key}',\n  endpoint: '${window.location.origin}/v1/ingest'\n}));`;
  const goSnippet = `client := apphealth.New(apphealth.Config{\n  IngestKey: "${key}",\n  IngestURL: "${window.location.origin}/v1/ingest",\n})\nhandler := client.Middleware(mux)`;
  const snippet = runtime === 'node' ? nodeSnippet : goSnippet;

  async function copy(value: string, label: string): Promise<void> {
    await navigator.clipboard?.writeText(value);
    setCopied(label);
  }

  return (
    <main className="install-shell">
      <div className="install-heading">
        <div className="success-mark" aria-hidden="true">
          ✓
        </div>
        <div>
          <div className="eyebrow">Project created</div>
          <h1>Instrument {created.app.name}</h1>
          <p>This key is shown once. Copy it now; App Health stores only its verifier.</p>
        </div>
      </div>
      <section className="key-panel">
        <div>
          <span>Ingest key</span>
          <code>{key}</code>
        </div>
        <button className="secondary-button" onClick={() => void copy(key, 'key')}>
          {copied === 'key' ? 'Copied' : 'Copy key'}
        </button>
      </section>
      <section className="snippet-panel">
        <div className="runtime-tabs" role="tablist" aria-label="SDK runtime">
          <button role="tab" aria-selected={runtime === 'node'} onClick={() => setRuntime('node')}>
            Node.js
          </button>
          <button role="tab" aria-selected={runtime === 'go'} onClick={() => setRuntime('go')}>
            Go
          </button>
        </div>
        <pre>
          <code>{snippet}</code>
        </pre>
        <button
          className="secondary-button copy-snippet"
          onClick={() => void copy(snippet, 'snippet')}
        >
          {copied === 'snippet' ? 'Copied snippet' : 'Copy snippet'}
        </button>
      </section>
      <div className="install-footer">
        <p>Run your application and make one request to any route.</p>
        <button className="primary-button" onClick={onDone}>
          I saved the key <span aria-hidden="true">→</span>
        </button>
      </div>
    </main>
  );
}

function StatusBanner({ status }: { status: InstallationStatusV1 }): JSX.Element {
  const copy = {
    waiting: [
      'Waiting for traffic',
      'Start your service and make one request. This page checks automatically.',
    ],
    connected: [
      'SDK connected',
      status.runtime
        ? `${status.runtime === 'node' ? 'Node.js' : 'Go'} is sending endpoint summaries.`
        : 'Endpoint summaries are arriving.',
    ],
    stale: [
      'Traffic has gone quiet',
      'The SDK connected before, but no recent events arrived. Check that your service is running.',
    ],
    revoked: [
      'Ingest key revoked',
      'Create a fresh project key before this service can send more endpoint summaries.',
    ],
    error: [
      'Installation check unavailable',
      'The metrics API could not verify this installation. Your application remains unaffected.',
    ],
  }[status.state];
  return (
    <section className={`status-banner status-${status.state}`} aria-live="polite">
      <span className="status-icon" aria-hidden="true">
        {status.state === 'connected' ? '✓' : status.state === 'waiting' ? '…' : '!'}
      </span>
      <div>
        <strong>{copy[0]}</strong>
        <p>{copy[1]}</p>
      </div>
      {status.state === 'waiting' ? <span className="checking">Checking every 10s</span> : null}
    </section>
  );
}

function EndpointTableRow({ endpoint }: { endpoint: EndpointAggregateV1 }): JSX.Element {
  return (
    <tr>
      <td>
        <span className={methodClass(endpoint.method)}>{endpoint.method}</span>
      </td>
      <td>
        <code className="route">{endpoint.route}</code>
      </td>
      <td>{endpoint.request_count.toLocaleString()}</td>
      <td className={endpoint.error_rate >= 0.01 ? 'metric-warn' : ''}>
        {(endpoint.error_rate * 100).toFixed(1)}%
      </td>
      <td>{endpoint.p50_ms} ms</td>
      <td>{endpoint.p95_ms} ms</td>
      <td>{formatAge(endpoint.last_seen)}</td>
      <td>
        <span className={`health health-${endpoint.health_state}`}>
          <i />
          {endpoint.health_state.replace('-', ' ')}
        </span>
      </td>
    </tr>
  );
}

function EndpointCard({ endpoint }: { endpoint: EndpointAggregateV1 }): JSX.Element {
  return (
    <article className="endpoint-card">
      <div className="endpoint-card-head">
        <div>
          <span className={methodClass(endpoint.method)}>{endpoint.method}</span>
          <code className="route">{endpoint.route}</code>
        </div>
        <span className={`health health-${endpoint.health_state}`}>
          <i />
          {endpoint.health_state.replace('-', ' ')}
        </span>
      </div>
      <dl>
        <div>
          <dt>Requests</dt>
          <dd>{endpoint.request_count.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Error rate</dt>
          <dd>{(endpoint.error_rate * 100).toFixed(1)}%</dd>
        </div>
        <div>
          <dt>p50</dt>
          <dd>{endpoint.p50_ms} ms</dd>
        </div>
        <div>
          <dt>p95</dt>
          <dd>{endpoint.p95_ms} ms</dd>
        </div>
      </dl>
      <p>Last seen {formatAge(endpoint.last_seen)}</p>
    </article>
  );
}

function Dashboard({
  project,
  onReset,
}: {
  project: SavedProject;
  onReset: () => void;
}): JSX.Element {
  const [windowKey, setWindowKey] = useState<Window>('15m');
  const [sortKey, setSortKey] = useState<SortKey>('health');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [data, setData] = useState<EndpointQueryResponseV1 | null>(null);
  const [status, setStatus] = useState<InstallationStatusV1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const endpointsUrl = apiUrl('/v1/endpoints');
        endpointsUrl.searchParams.set('app_id', project.appId);
        endpointsUrl.searchParams.set('environment_id', project.environmentId);
        endpointsUrl.searchParams.set('window', windowKey);
        endpointsUrl.searchParams.set('sort', sortKey);
        endpointsUrl.searchParams.set('sort_dir', sortDirection);
        const statusUrl = apiUrl('/v1/installation/status');
        statusUrl.searchParams.set('app_id', project.appId);
        statusUrl.searchParams.set('environment_id', project.environmentId);
        const [endpointResponse, statusResponse] = await Promise.all([
          fetch(endpointsUrl),
          fetch(statusUrl),
        ]);
        if (!endpointResponse.ok || !statusResponse.ok)
          throw new Error(
            `API returned ${!endpointResponse.ok ? endpointResponse.status : statusResponse.status}`,
          );
        const nextData = (await endpointResponse.json()) as EndpointQueryResponseV1;
        const nextStatus = (await statusResponse.json()) as InstallationStatusV1;
        if (!cancelled) {
          setData(nextData);
          setStatus(nextStatus);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unknown API error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    setLoading(true);
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [project, windowKey, sortKey, sortDirection]);

  const sorted = useMemo(
    () => sortEndpoints(data?.endpoints ?? [], sortKey, sortDirection),
    [data, sortKey, sortDirection],
  );

  function changeSort(next: SortKey): void {
    if (next === sortKey) setSortDirection((value) => (value === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(next);
      setSortDirection('desc');
    }
  }

  return (
    <div className="product-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="App Health home">
          <span className="brand-mark">
            <i />
            <i />
            <i />
          </span>
          App Health
        </a>
        <div className="project-switcher">
          <span className="project-avatar">{project.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{project.name}</strong>
            <span>{project.environment}</span>
          </div>
          <button aria-label="Forget local project" onClick={onReset}>
            •••
          </button>
        </div>
      </header>
      <main className="dashboard">
        <div className="dashboard-heading">
          <div>
            <div className="eyebrow">Observed routes</div>
            <h1>Endpoint health</h1>
            <p>Traffic, errors, and latency from requests your service actually handled.</p>
          </div>
          <div className="window-control" aria-label="Time window">
            {WINDOWS.map((value) => (
              <button
                key={value}
                aria-pressed={windowKey === value}
                onClick={() => setWindowKey(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
        {error ? (
          <section className="api-error" role="alert">
            <div>
              <strong>Can’t refresh endpoint data</strong>
              <p>{error}. Your application is unaffected; the SDK fails open.</p>
            </div>
            <button className="secondary-button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </section>
        ) : null}
        {status ? <StatusBanner status={status} /> : null}
        <section className="endpoint-surface" aria-busy={loading}>
          <div className="surface-heading">
            <div>
              <h2>Endpoints</h2>
              <span>{sorted.length} observed</span>
            </div>
            <label>
              Sort by
              <select
                aria-label="Sort endpoints"
                value={sortKey}
                onChange={(event) => changeSort(event.target.value as SortKey)}
              >
                <option value="health">Health</option>
                <option value="requests">Requests</option>
                <option value="error_rate">Error rate</option>
                <option value="p95">p95 latency</option>
                <option value="last_seen">Last seen</option>
              </select>
            </label>
          </div>
          {loading && !data ? (
            <div className="loading-state">
              <span />
              <span />
              <span />
            </div>
          ) : null}
          {!loading && !error && sorted.length === 0 ? (
            <div className="empty-state">
              <div className="empty-pulse">
                <i />
              </div>
              <h3>No endpoints observed yet</h3>
              <p>
                Start {project.name}, then make a request to any route. It will appear here within a
                few seconds.
              </p>
              <code>curl http://localhost:3000/health</code>
            </div>
          ) : null}
          {sorted.length > 0 ? (
            <>
              <div className="table-scroll">
                <table className="endpoint-table">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>Route</th>
                      {(
                        [
                          ['requests', 'Requests'],
                          ['error_rate', 'Error rate'],
                          ['p95', 'p50'],
                          ['p95', 'p95'],
                          ['last_seen', 'Last seen'],
                          ['health', 'Health'],
                        ] as [SortKey, string][]
                      ).map(([key, label]) => (
                        <th key={`${key}-${label}`}>
                          <button onClick={() => changeSort(key)}>
                            {label}
                            {sortKey === key ? (
                              <span
                                aria-label={sortDirection === 'desc' ? 'descending' : 'ascending'}
                              >
                                {sortDirection === 'desc' ? '↓' : '↑'}
                              </span>
                            ) : null}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((endpoint) => (
                      <EndpointTableRow
                        key={`${endpoint.method}|${endpoint.route}`}
                        endpoint={endpoint}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="endpoint-cards">
                {sorted.map((endpoint) => (
                  <EndpointCard key={`${endpoint.method}|${endpoint.route}`} endpoint={endpoint} />
                ))}
              </div>
            </>
          ) : null}
        </section>
        <section className="threshold-note">
          <strong>How health is decided</strong>
          <p>
            <span className="dot healthy" />
            Healthy{' '}
            <b>
              under {DEGRADED_ERROR_RATE * 100}% errors &amp; {DEGRADED_P95_MS / 1000}s p95
            </b>
            <span className="dot degraded" />
            Degraded{' '}
            <b>
              ≥{DEGRADED_ERROR_RATE * 100}% errors or {DEGRADED_P95_MS / 1000}s p95
            </b>
            <span className="dot unhealthy" />
            Unhealthy{' '}
            <b>
              ≥{UNHEALTHY_ERROR_RATE * 100}% errors or {UNHEALTHY_P95_MS / 1000}s p95
            </b>
            <span className="dot low" />
            Low volume <b>under {INSUFFICIENT_DATA_MIN_REQUESTS} requests</b>
          </p>
        </section>
        <footer>
          <span>Updated {data ? formatAge(data.refreshed_at) : '—'}</span>
          <span>Only aggregate route metrics are stored · no headers, bodies, or identities</span>
        </footer>
      </main>
    </div>
  );
}

export function App(): JSX.Element {
  const [project, setProject] = useState<SavedProject | null>(() => {
    if (
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get('demo') === 'populated'
    )
      return {
        appId: SEED_APP_ID,
        environmentId: SEED_ENV_ID,
        name: SEED_APP_NAME,
        environment: SEED_ENV_NAME,
      };
    return readProject();
  });
  const [created, setCreated] = useState<CreateAppResponseV1 | null>(null);

  function handleCreated(value: CreateAppResponseV1): void {
    const saved = {
      appId: value.app.id,
      environmentId: value.environment.id,
      name: value.app.name,
      environment: value.environment.name,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    setProject(saved);
    setCreated(value);
  }

  function reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    setCreated(null);
    setProject(null);
  }

  if (created) return <KeySetup created={created} onDone={() => setCreated(null)} />;
  if (!project) return <Setup onCreated={handleCreated} />;
  return <Dashboard project={project} onReset={reset} />;
}
