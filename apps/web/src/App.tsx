// V0 web shell. Wave 0 renders the seeded observed-endpoint table from the
// local worker so the dashboard surface exists end to end. The full operator
// flow (app creation, one-time key display, install snippets, sorting,
// waiting/stale/revoked states) is Wave 2.

import { useEffect, useState } from 'react';
import {
  SEED_APP_ID,
  SEED_ENV_ID,
  WINDOWS,
  type EndpointAggregateV1,
  type Window,
} from '@app-health/contracts';

const API_BASE =
  (import.meta.env.VITE_APP_HEALTH_API as string | undefined) ?? 'http://localhost:8787';

interface QueryResponse {
  refreshed_at: number;
  window: Window;
  endpoints: EndpointAggregateV1[];
}

export function App(): JSX.Element {
  const [window, setWindow] = useState<Window>('15m');
  const [data, setData] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const url = new URL(`${API_BASE}/v1/endpoints`);
        url.searchParams.set('app_id', SEED_APP_ID);
        url.searchParams.set('environment_id', SEED_ENV_ID);
        url.searchParams.set('window', window);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as QueryResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [window]);

  return (
    <div className="app">
      <h1>App Health — observed endpoints</h1>
      <p className="muted">
        V0 dev shell. Shows observed endpoint traffic from the local in-memory adapter. Source-route
        inventory is intentionally not shown.
      </p>
      <label className="muted">
        Window:{' '}
        <select
          value={window}
          onChange={(e) => setWindow(e.target.value as Window)}
          aria-label="time window"
        >
          {WINDOWS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="error" role="alert">
          Failed to load endpoints: {error}
        </p>
      ) : null}
      <table className="endpoint-table" aria-label="observed endpoints">
        <thead>
          <tr>
            <th>Method</th>
            <th>Route</th>
            <th>Requests</th>
            <th>Error rate</th>
            <th>p50</th>
            <th>p95</th>
            <th>Last seen</th>
            <th>Health</th>
          </tr>
        </thead>
        <tbody>
          {data?.endpoints.map((e) => (
            <tr key={`${e.method}|${e.route}`}>
              <td>{e.method}</td>
              <td>{e.route}</td>
              <td>{e.request_count}</td>
              <td>{(e.error_rate * 100).toFixed(1)}%</td>
              <td>{e.p50_ms}ms</td>
              <td>{e.p95_ms}ms</td>
              <td>{e.last_seen ? new Date(e.last_seen).toISOString() : '—'}</td>
              <td>
                <span className={`health ${e.health_state}`}>{e.health_state}</span>
              </td>
            </tr>
          ))}
          {data && data.endpoints.length === 0 ? (
            <tr>
              <td colSpan={8} className="muted">
                No traffic observed yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
