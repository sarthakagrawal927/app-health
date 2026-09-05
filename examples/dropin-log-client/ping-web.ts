// Drop-in browser log client for App Health. Zero dependencies, ~60 lines.
// Copy into a static site (Astro landing, plain HTML) and call:
//
//   import { createPingWeb } from './ping-web';
//   const ping = createPingWeb({ publicKey: 'ahk_pub_…', environment: 'production' });
//   ping('waitlist.opened');
//   ping('waitlist.joined', { title: email, props: { source: 'hero' } });
//
// Public keys are created in the dashboard's Logs tab and pinned to your
// site's origin, so they are safe to ship in page JavaScript. Each call sends
// one text/plain POST (no CORS preflight); when the page is hiding it uses
// sendBeacon so the last events still arrive.

type Level = 'debug' | 'info' | 'warn' | 'error';
type Scalar = string | number | boolean | null | undefined;

interface PingWebOptions {
  level?: Level;
  title?: string;
  description?: string;
  icon?: string;
  props?: Record<string, Scalar>;
}

interface PingWebConfig {
  publicKey: string;
  environment?: string;
  endpoint?: string;
}

const DEFAULT_ENDPOINT = 'https://ingest.sassmaker.com/v1/logs';

function uuid(): string {
  return crypto.randomUUID();
}

export function createPingWeb(config: PingWebConfig) {
  const endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
  return function ping(event: string, options: PingWebOptions = {}): void {
    const props: Record<string, Exclude<Scalar, undefined>> = {};
    for (const [key, value] of Object.entries(options.props ?? {})) {
      if (value !== undefined) props[key] = value;
    }
    const body = JSON.stringify({
      public_key: config.publicKey,
      batch_id: uuid(),
      schema_version: 'v1',
      ...(config.environment ? { environment: config.environment } : {}),
      logs: [
        {
          log_id: uuid(),
          timestamp: Date.now(),
          event,
          level: options.level ?? 'info',
          title: options.title,
          description: options.description,
          icon: options.icon,
          props,
        },
      ],
    });
    const hiding = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (hiding && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }));
      return;
    }
    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body,
      keepalive: true,
    }).catch(() => {
      /* fail open: logging must never break the page */
    });
  };
}
