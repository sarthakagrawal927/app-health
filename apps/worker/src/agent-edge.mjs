/**
 * Portable agent-edge handler — copy or generate into each product.
 * Spec: foundry/ops/docs/agent-indexing-standard.md
 *
 * Usage in worker.mjs (before openNext.fetch):
 *   import { handleAgentEdge } from './agent-edge.mjs'
 *   const agent = handleAgentEdge(request)
 *   if (agent) return agent
 */

/* global Response, URL */

/** @type {{ name: string, url: string, llmsTxt: string, llmsFullTxt?: string, indexMd: string, catalog: object }} */
// biome-ignore format: generated payload from apply-agent-surfaces (JSON keys/quotes)
const AGENT_SURFACE = {
  name: 'App Health',
  url: 'https://health.sassmaker.com',
  llmsFullTxt:
    '# App Health — full agent brief\n\nPrivacy-first endpoint health for Node, Go, Cloudflare, and OpenTelemetry services.\n\n## Index\n\n# App Health\n\nPrivacy-first endpoint health for Node, Go, Cloudflare, and OpenTelemetry services.\n\n## Public boundary\n\n- Aggregate endpoint latency, status, and availability summaries\n- Endpoint telemetry carries no request bodies, headers, cookies, query values, identities, or stack traces\n- Application logs are separate, explicit, owner-sent events (not derived from traffic)\n- Owner APIs remain authenticated and are not agent-indexed\n\n## Agent entrypoints\n\n- https://health.sassmaker.com/llms.txt\n- https://health.sassmaker.com/api/ai\n- https://health.sassmaker.com/index.md\n\n## Product links\n\n- Home: https://health.sassmaker.com/ — Endpoint health dashboard\n- Changelog: https://health.sassmaker.com/changelog — Verified product releases\n\n## Machine surfaces\n\n- https://health.sassmaker.com/llms.txt\n- https://health.sassmaker.com/llms-full.txt\n- https://health.sassmaker.com/api/ai\n- https://health.sassmaker.com/index.md\n- https://health.sassmaker.com/sitemap.xml\n- https://health.sassmaker.com/robots.txt\n\n## Contact\n\n- Owner: https://sarthakagrawal.dev\n- Agent email for directory verification: sarthakagrawal@agentmail.to\n',
  llmsTxt:
    '# App Health\n\n> Privacy-first endpoint health for Node, Go, Cloudflare, and OpenTelemetry services.\n\n## Product\n\n- [Home](https://health.sassmaker.com/): Endpoint health dashboard\n- [Changelog](https://health.sassmaker.com/changelog): Verified product releases\n\n## Machine surfaces\n\n- [Agent catalog](https://health.sassmaker.com/api/ai): JSON inventory of public surfaces\n- [OpenAPI spec](https://health.sassmaker.com/openapi.json): Machine-readable API description\n- [Homepage markdown](https://health.sassmaker.com/index.md): Product brief without JS\n- [This index](https://health.sassmaker.com/llms.txt)\n\n## When to use this\n\n- Monitoring endpoint health and availability for Node, Go, Cloudflare, or OpenTelemetry services\n- Checking aggregate latency, status codes, and uptime summaries (privacy-first, no PII)\n- Integrating a lightweight health-check SDK into a service for endpoint tracking\n- Reviewing verified product releases and changelog history\n',
  indexMd:
    '# App Health\n\nPrivacy-first endpoint health for Node, Go, Cloudflare, and OpenTelemetry services.\n\n## Public boundary\n\n- Aggregate endpoint latency, status, and availability summaries\n- Endpoint telemetry carries no request bodies, headers, cookies, query values, identities, or stack traces\n- Application logs are separate, explicit, owner-sent events (not derived from traffic)\n- Owner APIs remain authenticated and are not agent-indexed\n\n## Agent entrypoints\n\n- https://health.sassmaker.com/llms.txt\n- https://health.sassmaker.com/api/ai\n- https://health.sassmaker.com/index.md\n',
  catalog: {
    name: 'App Health',
    version: '1',
    url: 'https://health.sassmaker.com',
    llms: 'https://health.sassmaker.com/llms.txt',
    llmsFull: 'https://health.sassmaker.com/llms-full.txt',
    sitemap: 'https://health.sassmaker.com/sitemap.xml',
    robots: 'https://health.sassmaker.com/robots.txt',
    openapi: 'https://health.sassmaker.com/openapi.json',
    markdown: {
      suffix: '.md',
      negotiation: true,
    },
    surfaces: [
      {
        id: 'home',
        url: 'https://health.sassmaker.com/',
        md: 'https://health.sassmaker.com/index.md',
        kind: 'static',
        description: 'Product home',
      },
      {
        id: 'changelog',
        url: 'https://health.sassmaker.com/changelog',
        md: 'https://health.sassmaker.com/changelog.md',
        kind: 'static',
        description: 'Verified product releases',
      },
    ],
    auth: {
      public: true,
      notes: 'Auth-walled app routes are not agent-indexed unless listed here.',
    },
  },
};

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'App Health public API',
    version: '1.0.0',
    description:
      'Privacy-first endpoint health for Node, Go, Cloudflare, and OpenTelemetry services. The public web API exposes read-only agent surfaces: the agent catalog, llms.txt, sitemap, and markdown alternates.',
    contact: { name: 'App Health', url: 'https://health.sassmaker.com' },
  },
  servers: [{ url: 'https://health.sassmaker.com' }],
  tags: [{ name: 'agent-surfaces', description: 'Machine-readable public surfaces' }],
  paths: {
    '/api/ai': {
      get: {
        operationId: 'getAgentCatalog',
        tags: ['agent-surfaces'],
        summary: 'Agent catalog',
        description: 'JSON inventory of public agent surfaces.',
        responses: {
          200: {
            description: 'Agent catalog',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/AgentCatalog' } },
            },
          },
        },
      },
    },
    '/llms.txt': {
      get: {
        operationId: 'getLlmsTxt',
        tags: ['agent-surfaces'],
        summary: 'llms.txt index',
        responses: { 200: { description: 'Markdown index', content: { 'text/plain': {} } } },
      },
    },
    '/llms-full.txt': {
      get: {
        operationId: 'getLlmsFullTxt',
        tags: ['agent-surfaces'],
        summary: 'Full agent brief',
        responses: { 200: { description: 'Markdown brief', content: { 'text/plain': {} } } },
      },
    },
    '/sitemap.xml': {
      get: {
        operationId: 'getSitemap',
        tags: ['agent-surfaces'],
        summary: 'Sitemap',
        responses: { 200: { description: 'XML sitemap', content: { 'application/xml': {} } } },
      },
    },
    '/openapi.json': {
      get: {
        operationId: 'getOpenApiSpec',
        tags: ['agent-surfaces'],
        summary: 'OpenAPI specification',
        description: 'This document.',
        responses: {
          200: { description: 'OpenAPI 3.1 spec', content: { 'application/json': {} } },
        },
      },
    },
  },
  components: {
    schemas: {
      AgentCatalog: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          version: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          llms: { type: 'string', format: 'uri' },
          llmsFull: { type: 'string', format: 'uri' },
          sitemap: { type: 'string', format: 'uri' },
          robots: { type: 'string', format: 'uri' },
          openapi: { type: 'string', format: 'uri' },
          markdown: {
            type: 'object',
            properties: { suffix: { type: 'string' }, negotiation: { type: 'boolean' } },
          },
        },
      },
    },
  },
};

function jsonError(status, code, message, path) {
  return new Response(JSON.stringify({ error: { code, message, path } }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

/** @returns {Response} */
function openApiResponse() {
  return new Response(JSON.stringify(OPENAPI_SPEC, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=3600',
    },
  });
}

/**
 * Re-bind the catalog to the requesting origin so preview and custom domains stay correct.
 * @param {URL} url
 * @returns {Response}
 */
function catalogResponse(url) {
  const rebind = (value) => (value ? String(value).replace(AGENT_SURFACE.url, url.origin) : value);
  return json({
    ...AGENT_SURFACE.catalog,
    url: url.origin,
    llms: `${url.origin}/llms.txt`,
    llmsFull: `${url.origin}/llms-full.txt`,
    sitemap: rebind(AGENT_SURFACE.catalog.sitemap) || `${url.origin}/sitemap.xml`,
    openapi: `${url.origin}/openapi.json`,
    surfaces: (AGENT_SURFACE.catalog.surfaces || []).map((surface) => ({
      ...surface,
      url: rebind(surface.url),
      md: rebind(surface.md),
    })),
  });
}

/** @returns {Response} */
function homepageMarkdownResponse() {
  return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8', {
    Link: '</index.md>; rel="alternate"; type="text/markdown"',
    Vary: 'Accept, Accept-Encoding',
  });
}

/**
 * Exact-path surfaces. Each entry is a thunk so nothing is built until its path is asked for.
 * Keeping them in a table rather than an if-chain is what holds handleAgentEdge's
 * cyclomatic complexity inside the repo's code-health ceiling.
 * @type {Record<string, (url: URL) => Response | null>}
 */
const AGENT_ROUTES = {
  '/openapi.json': openApiResponse,
  '/openapi.yaml': openApiResponse,
  '/llms.txt': () => text(AGENT_SURFACE.llmsTxt, 'text/plain; charset=utf-8'),
  '/llms-full.txt': () =>
    AGENT_SURFACE.llmsFullTxt ? text(AGENT_SURFACE.llmsFullTxt, 'text/plain; charset=utf-8') : null,
  '/index.md': () => text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8'),
  '/api/ai': (url) => catalogResponse(url),
};

/**
 * @param {Request} request
 * @returns {Response | null}
 */
export function handleAgentEdge(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const path = url.pathname || '/';

  const route = AGENT_ROUTES[path];
  if (route) return route(url);

  // Unknown API paths answer in JSON, never the HTML app shell.
  if (path.startsWith('/api/')) {
    return jsonError(404, 'not_found', `Unknown API path: ${path}`, path);
  }

  // Homepage markdown negotiation
  if (path === '/' && wantsMarkdown(request)) return homepageMarkdownResponse();

  return null;
}

function wantsMarkdown(request) {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  if (!accept.includes('text/markdown')) return false;
  if (!accept.includes('text/html')) return true;
  return accept.indexOf('text/markdown') < accept.indexOf('text/html');
}

function text(body, type, extra = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=300',
      ...extra,
    },
  });
}

function json(data) {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
