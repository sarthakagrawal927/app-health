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
  type FailureEventV1,
  type FailureQueryResponseV1,
  type InstallationStatusV1,
  type ListAppsResponseV1,
  type Window,
} from '@app-health/contracts';

const API_BASE = (import.meta.env.VITE_APP_HEALTH_API as string | undefined) ?? '';
const INGEST_ORIGIN =
  (import.meta.env.VITE_APP_HEALTH_INGEST_ORIGIN as string | undefined) ?? window.location.origin;
const STORAGE_KEY = 'app-health-v0-project';

type SortKey = 'health' | 'requests' | 'error_rate' | 'p95' | 'last_seen';
type SortDirection = 'asc' | 'desc';
type DashboardView = 'endpoints' | 'data';

const WINDOW_LABELS: Record<Window, string> = {
  '15m': '15 minutes',
  '1h': '1 hour',
  '24h': '24 hours',
};

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

function ownerHeaders(ownerToken: string, headers?: HeadersInit): Headers {
  const next = new Headers(headers);
  if (ownerToken) next.set('authorization', `Bearer ${ownerToken}`);
  return next;
}

function ownerFetch(
  path: string | URL,
  ownerToken: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = typeof path === 'string' ? apiUrl(path) : path;
  return fetch(url, { ...init, headers: ownerHeaders(ownerToken, init.headers) });
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

function availableProjects(listed: ListAppsResponseV1): SavedProject[] {
  return listed.apps.flatMap((entry) =>
    entry.environments.map((environment) => ({
      appId: entry.app.id,
      environmentId: environment.id,
      name: entry.app.name,
      environment: environment.name,
    })),
  );
}

function authorizedProject(
  current: SavedProject | null,
  available: SavedProject[],
): SavedProject | null {
  if (!current) return available[0] ?? null;
  return (
    available.find(
      (candidate) =>
        candidate.appId === current.appId && candidate.environmentId === current.environmentId,
    ) ??
    available[0] ??
    null
  );
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
      if (key !== 'last_seen' && a.endpoint.metrics_available !== b.endpoint.metrics_available) {
        return a.endpoint.metrics_available === false ? 1 : -1;
      }
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

export function OwnerUnlock({
  onUnlock,
}: {
  onUnlock: (token: string, listed: ListAppsResponseV1) => void;
}): JSX.Element {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await ownerFetch('/v1/apps', token.trim());
      if (response.status === 403) throw new Error('That owner key was not accepted');
      if (!response.ok) throw new Error(`App Health returned ${response.status}`);
      onUnlock(token.trim(), (await response.json()) as ListAppsResponseV1);
      setToken('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not unlock App Health');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="unlock-shell">
      <section className="unlock-intro" aria-labelledby="unlock-title">
        <a className="brand" href="/" aria-label="App Health home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          App Health
        </a>
        <h1 id="unlock-title">Your services, at a glance.</h1>
        <p>
          Unlock the private operator view to issue SDK keys and inspect aggregate endpoint health.
        </p>
        <ul aria-label="Privacy guarantees">
          <li>No request bodies or identities</li>
          <li>No owner key stored in this browser</li>
          <li>Aggregate route metrics only</li>
        </ul>
      </section>
      <section className="unlock-panel" aria-label="Unlock App Health">
        <div className="unlock-status">
          <span className="signal-dot" /> Private operator access
        </div>
        <h2>Unlock dashboard</h2>
        <p>Use the owner key saved for this Cloudflare deployment.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label>
            Owner key
            <input
              autoComplete="current-password"
              autoFocus
              maxLength={256}
              onChange={(event) => setToken(event.target.value)}
              placeholder="aho_••••••••••••"
              required
              spellCheck={false}
              type="password"
              value={token}
            />
          </label>
          {error ? (
            <div className="inline-error" role="alert">
              {error}. Check the key and try again.
            </div>
          ) : null}
          <button className="primary-button" disabled={submitting || !token.trim()} type="submit">
            {submitting ? 'Checking…' : 'Unlock'}
            <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="unlock-note">The key stays in memory and is cleared when this page closes.</p>
      </section>
    </main>
  );
}

function Setup({
  ownerToken,
  onCreated,
}: {
  ownerToken: string;
  onCreated: (created: CreateAppResponseV1) => void;
}): JSX.Element {
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await ownerFetch('/v1/apps', ownerToken, {
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
          Add one lightweight middleware, or connect an existing OpenTelemetry pipeline. App Health
          turns observed requests into a focused view of traffic, latency, and errors—without
          storing request data.
        </p>
        <div className="trust-list" aria-label="Product guarantees">
          <span>Method + route only</span>
          <span>Fail-open SDKs</span>
          <span>OTLP compatible</span>
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
        <p className="fine-print">
          {import.meta.env.DEV
            ? 'Local V0 · no cloud resources are created'
            : 'Private owner session · the owner key is never stored'}
        </p>
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
  const [runtime, setRuntime] = useState<'express' | 'hono' | 'pages' | 'echo' | 'otel'>('express');
  const [copied, setCopied] = useState<string | null>(null);
  const key = created.key.key;
  const expressSnippet = `npm install @saas-maker/app-health\n\nimport { createAppHealthClient } from '@saas-maker/app-health';\nimport { expressMiddleware } from '@saas-maker/app-health/express';\n\nconst appHealth = createAppHealthClient({\n  key: '${key}',\n  environment: ${JSON.stringify(created.environment.name)},\n  endpoint: '${INGEST_ORIGIN}/v1/ingest',\n});\n\napp.use(expressMiddleware({ client: appHealth }));`;
  const honoSnippet = `npm install https://github.com/sass-maker/app-health/releases/download/node-v0.2.1/saas-maker-app-health-0.2.1.tgz\n\nimport { createAppHealthClient } from '@saas-maker/app-health';\nimport { honoMiddleware } from '@saas-maker/app-health/hono';\n\nconst appHealth = createAppHealthClient({\n  key: '${key}',\n  environment: ${JSON.stringify(created.environment.name)},\n  endpoint: '${INGEST_ORIGIN}/v1/ingest',\n  runtime: 'worker',\n  disableTimer: true,\n});\n\napp.use('*', honoMiddleware({ client: appHealth }));`;
  const pagesSnippet = `npm install https://github.com/sass-maker/app-health/releases/download/node-v0.2.1/saas-maker-app-health-0.2.1.tgz\n\nimport { createAppHealthClient } from '@saas-maker/app-health';\nimport { withPagesFunctionHealth } from '@saas-maker/app-health/pages';\n\nconst appHealth = createAppHealthClient({\n  key: '${key}',\n  environment: ${JSON.stringify(created.environment.name)},\n  endpoint: '${INGEST_ORIGIN}/v1/ingest',\n  runtime: 'worker',\n  disableTimer: true,\n});\n\nexport const onRequestGet = withPagesFunctionHealth(\n  { client: appHealth, route: '/users/:id' },\n  async () => Response.json({ ok: true }),\n);`;
  const echoSnippet = `go get github.com/sarthakagrawal927/app-health/packages/go/echo/v5@v5.1.0\n\nimport apphealthechov5 "github.com/sarthakagrawal927/app-health/packages/go/echo/v5"\n\ncleanup := apphealthechov5.Install(e, apphealthechov5.Config{\n  Enabled: true,\n  Environment: ${JSON.stringify(created.environment.name)},\n  Key: ${JSON.stringify(key)},\n  Project: ${JSON.stringify(created.app.name)},\n})\ndefer cleanup()`;
  const otelSnippet = `processors:\n  resource/app_health:\n    attributes:\n      - key: deployment.environment.name\n        value: ${JSON.stringify(created.environment.name)}\n        action: upsert\n\nexporters:\n  otlphttp/app_health:\n    traces_endpoint: '${INGEST_ORIGIN}/v1/traces'\n    headers:\n      Authorization: 'Bearer ${key}'\n\nservice:\n  pipelines:\n    traces:\n      # Keep your current receivers and processors.\n      processors: [your_existing_processors, resource/app_health]\n      exporters: [your_existing_exporter, otlphttp/app_health]`;
  const snippet = {
    express: expressSnippet,
    hono: honoSnippet,
    pages: pagesSnippet,
    echo: echoSnippet,
    otel: otelSnippet,
  }[runtime];

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
        <div className="runtime-tabs" role="tablist" aria-label="Ingestion source">
          <button
            role="tab"
            aria-selected={runtime === 'express'}
            onClick={() => setRuntime('express')}
          >
            Express
          </button>
          <button role="tab" aria-selected={runtime === 'hono'} onClick={() => setRuntime('hono')}>
            Hono Worker
          </button>
          <button
            role="tab"
            aria-selected={runtime === 'pages'}
            onClick={() => setRuntime('pages')}
          >
            Pages Functions
          </button>
          <button role="tab" aria-selected={runtime === 'echo'} onClick={() => setRuntime('echo')}>
            Go + Echo
          </button>
          <button role="tab" aria-selected={runtime === 'otel'} onClick={() => setRuntime('otel')}>
            Existing OpenTelemetry
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
        <p>
          {runtime === 'otel'
            ? 'Reload your Collector and send one traced request to a server route.'
            : 'Run your application and make one request to any route.'}
        </p>
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
      status.runtime === 'otel'
        ? 'OpenTelemetry connected'
        : status.runtime === 'worker'
          ? 'Cloudflare Worker connected'
          : 'SDK connected',
      status.runtime
        ? `${status.runtime === 'node' ? 'Node.js' : status.runtime === 'worker' ? 'Cloudflare Worker' : status.runtime === 'go' ? 'Go' : 'Your OpenTelemetry pipeline'} is sending endpoint summaries.`
        : 'Endpoint summaries are arriving.',
    ],
    stale: [
      'Traffic has gone quiet',
      'This source connected before, but no recent events arrived. Check that your service is running.',
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
  const hasMetrics = endpoint.metrics_available !== false;
  return (
    <tr>
      <td>
        <span className={methodClass(endpoint.method)}>{endpoint.method}</span>
      </td>
      <td>
        <div className="route-cell">
          <code className="route">{endpoint.route}</code>
          {endpoint.upstream_sampled ? (
            <span className="sampling-note">OTel sampled estimate</span>
          ) : null}
        </div>
      </td>
      <td>{hasMetrics ? endpoint.request_count.toLocaleString() : '—'}</td>
      <td className={hasMetrics && endpoint.error_rate >= 0.01 ? 'metric-warn' : ''}>
        {hasMetrics ? `${(endpoint.error_rate * 100).toFixed(1)}%` : '—'}
      </td>
      <td>{hasMetrics ? `${endpoint.p50_ms} ms` : '—'}</td>
      <td>{hasMetrics ? `${endpoint.p95_ms} ms` : '—'}</td>
      <td>{formatAge(endpoint.last_seen)}</td>
      <td>
        <span className={`health health-${endpoint.health_state}`}>
          <i />
          {hasMetrics ? endpoint.health_state.replace('-', ' ') : 'metrics sampled'}
        </span>
      </td>
    </tr>
  );
}

function EndpointCard({ endpoint }: { endpoint: EndpointAggregateV1 }): JSX.Element {
  const hasMetrics = endpoint.metrics_available !== false;
  return (
    <article className="endpoint-card">
      <div className="endpoint-card-head">
        <div>
          <span className={methodClass(endpoint.method)}>{endpoint.method}</span>
          <div className="route-cell">
            <code className="route">{endpoint.route}</code>
            {endpoint.upstream_sampled ? (
              <span className="sampling-note">OTel sampled estimate</span>
            ) : null}
          </div>
        </div>
        <span className={`health health-${endpoint.health_state}`}>
          <i />
          {hasMetrics ? endpoint.health_state.replace('-', ' ') : 'metrics sampled'}
        </span>
      </div>
      <dl>
        <div>
          <dt>Requests</dt>
          <dd>{hasMetrics ? endpoint.request_count.toLocaleString() : '—'}</dd>
        </div>
        <div>
          <dt>Error rate</dt>
          <dd>{hasMetrics ? `${(endpoint.error_rate * 100).toFixed(1)}%` : '—'}</dd>
        </div>
        <div>
          <dt>p50</dt>
          <dd>{hasMetrics ? `${endpoint.p50_ms} ms` : '—'}</dd>
        </div>
        <div>
          <dt>p95</dt>
          <dd>{hasMetrics ? `${endpoint.p95_ms} ms` : '—'}</dd>
        </div>
      </dl>
      <p>Last seen {formatAge(endpoint.last_seen)}</p>
    </article>
  );
}

const receivedFields = [
  ['batch_id', 'Retry deduplication', 'Short-lived', 'Eligible for cleanup after 1 hour'],
  ['schema_version', 'Contract validation', 'Not stored', 'Discarded after validation'],
  ['runtime', 'SDK and installation state', 'Latest + aggregate', 'Node, Worker, Go, or OTel'],
  ['release', 'Release comparison', 'Aggregate / failure', 'Failure value expires after 24 hours'],
  ['event_id', 'Failure identity', 'Failures only', 'Queryable for 24 hours'],
  ['timestamp', 'Windowing and freshness', 'Aggregate / inventory / failure', 'No request content'],
  ['method', 'Endpoint identity', 'Inventory + aggregate + failure', 'Uppercase HTTP method'],
  ['route', 'Endpoint identity', 'Inventory + aggregate + failure', 'Normalized template only'],
  [
    'status_code',
    'Counts and error classification',
    'Aggregate / failure',
    'Exact only for 4xx/5xx',
  ],
  ['duration_ms', 'Latency histogram', 'Aggregate / failure', 'Exact only for 4xx/5xx'],
] as const;

const excludedFields = [
  'Request bodies',
  'Response bodies',
  'Headers',
  'Cookies',
  'Query values',
  'Route parameter values',
  'User identity',
  'Logs and stack traces',
];

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(timestamp));
}

function FailureRow({ failure }: { failure: FailureEventV1 }): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const detailId = `failure-detail-${failure.failure_id}`;
  const endpointLabel = `${failure.method} ${failure.route} ${failure.status_code}`;

  return (
    <>
      <tr className={expanded ? 'failure-summary-row is-expanded' : 'failure-summary-row'}>
        <td data-label="Method">
          <span className={methodClass(failure.method)}>{failure.method}</span>
        </td>
        <td data-label="Normalized route">
          <code className="route">{failure.route}</code>
        </td>
        <td data-label="Status">
          <span className={`status-code status-code-${Math.floor(failure.status_code / 100)}xx`}>
            {failure.status_code}
          </span>
        </td>
        <td data-label="Duration">{failure.duration_ms.toLocaleString()} ms</td>
        <td data-label="Occurred" title={formatTimestamp(failure.occurred_at)}>
          {formatAge(failure.occurred_at)}
        </td>
        <td data-label="Release">{failure.release ?? '—'}</td>
        <td data-label="Failure ID" className="failure-id-cell">
          <code className="failure-id" title={failure.failure_id}>
            {failure.failure_id}
          </code>
          <button
            type="button"
            className="failure-detail-toggle"
            aria-expanded={expanded}
            aria-controls={detailId}
            aria-label={`${expanded ? 'Hide' : 'View'} details for ${endpointLabel}`}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? 'Hide details' : 'View details'}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="failure-detail-row">
          <td colSpan={7}>
            <div id={detailId} className="failure-detail-panel">
              <div className="failure-detail-heading">
                <strong>Retained failure detail</strong>
                <span>Exact fields kept for this failed request</span>
              </div>
              <dl className="failure-detail-grid">
                <div>
                  <dt>Endpoint</dt>
                  <dd>
                    <code>
                      {failure.method} {failure.route}
                    </code>
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{failure.status_code}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{failure.duration_ms.toLocaleString()} ms</dd>
                </div>
                <div>
                  <dt>Occurred</dt>
                  <dd>
                    <time dateTime={new Date(failure.occurred_at).toISOString()}>
                      {formatTimestamp(failure.occurred_at)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>Release</dt>
                  <dd>{failure.release ?? 'Not reported'}</dd>
                </div>
                <div>
                  <dt>Failure ID</dt>
                  <dd>
                    <code>{failure.failure_id}</code>
                  </dd>
                </div>
              </dl>
              <p className="failure-detail-boundary">
                No request body, headers, query values, route values, identity, logs, or stack
                traces were collected.
              </p>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function DataReceived({
  project,
  ownerToken,
  windowKey,
}: {
  project: SavedProject;
  ownerToken: string;
  windowKey: Window;
}): JSX.Element {
  const [data, setData] = useState<FailureQueryResponseV1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      try {
        const url = apiUrl('/v1/failures');
        url.searchParams.set('app_id', project.appId);
        url.searchParams.set('environment_id', project.environmentId);
        url.searchParams.set('window', windowKey);
        url.searchParams.set('limit', '50');
        const response = await ownerFetch(url, ownerToken);
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const next = (await response.json()) as FailureQueryResponseV1;
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load retained failures');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ownerToken, project, refresh, windowKey]);

  return (
    <div className="transparency-view">
      <section className="trust-statement" aria-labelledby="trust-statement-title">
        <div className="trust-signal" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <h2 id="trust-statement-title">Every request counts. Only failures leave a row.</h2>
          <p>
            2xx and 3xx requests are folded into counts and fixed latency buckets, then their
            individual events are discarded. 4xx and 5xx details remain queryable for 24 hours.
          </p>
        </div>
        <div className="trust-facts" aria-label="Retention summary">
          <span>
            <strong>10</strong> accepted fields
          </span>
          <span>
            <strong>0</strong> payload fields
          </span>
          <span>
            <strong>24h</strong> max retention
          </span>
        </div>
      </section>

      <section className="data-surface" aria-busy={loading}>
        <div className="surface-heading failure-heading">
          <div>
            <h2>Latest retained failures</h2>
            <span>
              {data?.failures.length ?? 0} of up to 50 shown
              {data ? ` · refreshed ${formatAge(data.refreshed_at)}` : ''}
            </span>
          </div>
          <button
            className="secondary-button compact-button"
            onClick={() => setRefresh((v) => v + 1)}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {error ? (
          <div className="failure-error" role="alert">
            <div>
              <strong>Failure details are unavailable</strong>
              <p>{error}. Collection policy and aggregate metrics are unchanged.</p>
            </div>
            <button className="secondary-button" onClick={() => setRefresh((v) => v + 1)}>
              Try again
            </button>
          </div>
        ) : null}
        {loading && !data ? (
          <div className="failure-loading" aria-label="Loading recent failures">
            <span />
            <span />
            <span />
          </div>
        ) : null}
        {!loading && !error && data?.failures.length === 0 ? (
          <div className="failure-empty">
            <strong>No retained failures in the last {WINDOW_LABELS[windowKey]}</strong>
            <p>
              There are no individual 4xx or 5xx rows in this period. Choose a longer period or
              check Endpoints for the complete aggregate traffic picture.
            </p>
          </div>
        ) : null}
        {data && data.failures.length > 0 ? (
          <div className="table-scroll">
            <table className="endpoint-table failure-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Normalized route</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Occurred</th>
                  <th>Release</th>
                  <th>Failure ID</th>
                </tr>
              </thead>
              <tbody>
                {data.failures.map((failure) => (
                  <FailureRow key={failure.failure_id} failure={failure} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="field-ledger" aria-labelledby="field-ledger-title">
        <div className="ledger-intro">
          <h2 id="field-ledger-title">The complete accepted shape</h2>
          <p>
            Unknown fields make the entire batch fail validation. App Health does not silently
            accept extra request data.
          </p>
        </div>
        <div className="table-scroll">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Why it arrives</th>
                <th>Where it remains</th>
                <th>Boundary</th>
              </tr>
            </thead>
            <tbody>
              {receivedFields.map(([field, purpose, destination, boundary]) => (
                <tr key={field}>
                  <td data-label="Field">
                    <code>{field}</code>
                  </td>
                  <td data-label="Why it arrives">{purpose}</td>
                  <td data-label="Where it remains">{destination}</td>
                  <td data-label="Boundary">{boundary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="excluded-data" aria-labelledby="excluded-data-title">
        <div>
          <h2 id="excluded-data-title">Never collected</h2>
          <p>These fields are absent from the SDK contract and rejected by the ingest validator.</p>
        </div>
        <ul>
          {excludedFields.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
      </section>

      <p className="transparency-footnote">
        Contract v1 is enforced by the ingest validator.{' '}
        <a
          href="https://github.com/sass-maker/app-health/blob/main/packages/contracts/src/event.ts"
          target="_blank"
          rel="noreferrer"
        >
          Inspect the source contract
        </a>
        . Raw ingest keys are shown once; only a non-reversible verifier is stored. Batch IDs stop
        participating in deduplication after one hour. Failure rows stop being queryable after 24
        hours and are queued for hourly deletion.
      </p>
    </div>
  );
}

function Dashboard({
  project,
  projects,
  ownerToken,
  onProjectChange,
  onReset,
  onLock,
}: {
  project: SavedProject;
  projects: SavedProject[];
  ownerToken: string;
  onProjectChange: (project: SavedProject) => void;
  onReset: () => void;
  onLock: () => void;
}): JSX.Element {
  const [view, setView] = useState<DashboardView>('endpoints');
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
          ownerFetch(endpointsUrl, ownerToken),
          ownerFetch(statusUrl, ownerToken),
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
  }, [ownerToken, project, windowKey, sortKey, sortDirection]);

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

  const environments = projects.filter((candidate) => candidate.appId === project.appId);

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
            <select
              aria-label="Environment"
              onChange={(event) => {
                const selected = environments.find(
                  (candidate) => candidate.environmentId === event.target.value,
                );
                if (selected) onProjectChange(selected);
              }}
              value={project.environmentId}
            >
              {environments.map((candidate) => (
                <option key={candidate.environmentId} value={candidate.environmentId}>
                  {candidate.environment}
                </option>
              ))}
            </select>
          </div>
          <button className="project-reset" aria-label="Forget local project" onClick={onReset}>
            Reset
          </button>
          <button className="lock-button" onClick={onLock}>
            Lock
          </button>
        </div>
      </header>
      <main className="dashboard">
        <nav className="view-tabs" aria-label="App Health views">
          <button
            aria-current={view === 'endpoints' ? 'page' : undefined}
            onClick={() => setView('endpoints')}
          >
            Endpoints
          </button>
          <button
            aria-current={view === 'data' ? 'page' : undefined}
            onClick={() => setView('data')}
          >
            Data received
          </button>
        </nav>
        <div className="dashboard-heading">
          <div>
            {view === 'endpoints' ? (
              <>
                <div className="eyebrow">Observed routes</div>
                <h1>Endpoint health</h1>
                <p>Traffic, errors, and latency from requests your service actually handled.</p>
              </>
            ) : (
              <>
                <div className="eyebrow">Collection transparency</div>
                <h1>Data received</h1>
                <p>The exact telemetry App Health accepts and retains for this environment.</p>
              </>
            )}
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
        {view === 'endpoints' ? (
          <>
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
                    Start {project.name}, then make a request to any route. It will appear here
                    within a few seconds.
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
                                    aria-label={
                                      sortDirection === 'desc' ? 'descending' : 'ascending'
                                    }
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
                      <EndpointCard
                        key={`${endpoint.method}|${endpoint.route}`}
                        endpoint={endpoint}
                      />
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
              <span>
                Percentiles are approximate · only aggregate route metrics are stored · no headers,
                bodies, or identities
              </span>
            </footer>
          </>
        ) : (
          <DataReceived project={project} ownerToken={ownerToken} windowKey={windowKey} />
        )}
      </main>
    </div>
  );
}

export function App(): JSX.Element {
  const [ownerToken, setOwnerToken] = useState<string | null>(() =>
    import.meta.env.DEV ? '' : null,
  );
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
  const [projects, setProjects] = useState<SavedProject[]>([]);

  useEffect(() => {
    if (ownerToken === null || (import.meta.env.DEV && !project)) return;
    const token = ownerToken;
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const response = await ownerFetch('/v1/apps', token);
        if (!response.ok) return;
        const listed = (await response.json()) as ListAppsResponseV1;
        const available = availableProjects(listed);
        if (cancelled) return;
        setProjects(available);
        const selected = authorizedProject(project, available);
        if (
          selected &&
          (selected.appId !== project?.appId || selected.environmentId !== project.environmentId)
        )
          selectProject(selected);
      } catch {
        // App-list refresh is best effort; dashboard queries report their own failures.
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ownerToken, project?.appId, project?.environmentId]);

  function selectProject(value: SavedProject): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    setProject(value);
    setCreated(null);
  }

  function handleCreated(value: CreateAppResponseV1): void {
    const saved = {
      appId: value.app.id,
      environmentId: value.environment.id,
      name: value.app.name,
      environment: value.environment.name,
    };
    setProjects((available) => [
      ...available.filter((candidate) => candidate.environmentId !== saved.environmentId),
      saved,
    ]);
    selectProject(saved);
    setCreated(value);
  }

  function handleUnlock(token: string, listed: ListAppsResponseV1): void {
    const available = availableProjects(listed);
    const selected = authorizedProject(project, available);
    setProjects(available);
    if (selected) selectProject(selected);
    else reset();
    setOwnerToken(token);
  }

  function reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    setCreated(null);
    setProject(null);
  }

  function lock(): void {
    if (!import.meta.env.DEV) setOwnerToken(null);
    setCreated(null);
  }

  if (ownerToken === null) return <OwnerUnlock onUnlock={handleUnlock} />;
  if (created) return <KeySetup created={created} onDone={() => setCreated(null)} />;
  if (!project) return <Setup ownerToken={ownerToken} onCreated={handleCreated} />;
  return (
    <Dashboard
      project={project}
      projects={
        projects.some((candidate) => candidate.environmentId === project.environmentId)
          ? projects
          : [project, ...projects]
      }
      ownerToken={ownerToken}
      onProjectChange={selectProject}
      onReset={reset}
      onLock={lock}
    />
  );
}
