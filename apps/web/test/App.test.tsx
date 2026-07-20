import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/App.js';
import { SEED_APP_ID, SEED_ENV_ID } from '@app-health/contracts';

const SAMPLE_RESPONSE = {
  refreshed_at: 1_725_000_000_000,
  window: '15m',
  endpoints: [
    {
      method: 'GET',
      route: '/health',
      request_count: 5,
      error_count: 0,
      error_rate: 0,
      p50_ms: 10,
      p95_ms: 12,
      last_seen: 1_725_000_000_000,
      health_state: 'insufficient-data',
    },
  ],
};

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL | string) => {
        const u = typeof url === 'string' ? new URL(url) : url;
        if (!u.searchParams.get('app_id')) {
          throw new Error('missing app_id');
        }
        return new Response(JSON.stringify(SAMPLE_RESPONSE), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the observed-endpoint heading', async () => {
    render(<App />);
    expect(screen.getByText(/App Health/i)).toBeTruthy();
  });

  it('renders the seeded endpoint row after fetch', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('/health')).toBeTruthy();
    });
    expect(screen.getByText('GET')).toBeTruthy();
  });

  it('uses the seeded app id in the request', async () => {
    render(<App />);
    await waitFor(() => {
      expect(
        (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length,
      ).toBeGreaterThan(0);
    });
    const firstCall = (fetch as unknown as { mock: { calls: [URL][] } }).mock.calls[0][0];
    expect(firstCall.searchParams.get('app_id')).toBe(SEED_APP_ID);
    expect(firstCall.searchParams.get('environment_id')).toBe(SEED_ENV_ID);
  });
});
