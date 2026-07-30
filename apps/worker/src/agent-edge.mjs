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
export const AGENT_SURFACE = {
  name: 'App Health',
  url: 'https://health.sassmaker.com',
  llmsFullTxt:
    '# App Health — full agent brief\n\nPrivacy-first endpoint health for Node, Go, Cloudflare, and OpenTelemetry services.\n\n## Index\n\n# App Health\n\nPrivacy-first endpoint health for Node, Go, Cloudflare, and OpenTelemetry services.\n\n## Public boundary\n\n- Aggregate endpoint latency, status, and availability summaries\n- No request bodies, headers, cookies, query values, identities, logs, or stack traces\n- Owner APIs remain authenticated and are not agent-indexed\n\n## Agent entrypoints\n\n- https://health.sassmaker.com/llms.txt\n- https://health.sassmaker.com/api/ai\n- https://health.sassmaker.com/index.md\n\n## Product links\n\n- Home: https://health.sassmaker.com/ — Endpoint health dashboard\n- Changelog: https://health.sassmaker.com/changelog — Verified product releases\n\n## Machine surfaces\n\n- https://health.sassmaker.com/llms.txt\n- https://health.sassmaker.com/llms-full.txt\n- https://health.sassmaker.com/api/ai\n- https://health.sassmaker.com/index.md\n- https://health.sassmaker.com/sitemap.xml\n- https://health.sassmaker.com/robots.txt\n\n## Contact\n\n- Owner: https://sarthakagrawal.dev\n- Agent email for directory verification: sarthakagrawal@agentmail.to\n',
  llmsTxt:
    '# App Health\n\n> Privacy-first endpoint health for Node, Go, Cloudflare, and OpenTelemetry services.\n\n## Product\n\n- [Home](https://health.sassmaker.com/): Endpoint health dashboard\n- [Changelog](https://health.sassmaker.com/changelog): Verified product releases\n\n## Machine surfaces\n\n- [Agent catalog](https://health.sassmaker.com/api/ai): JSON inventory of public surfaces\n- [Homepage markdown](https://health.sassmaker.com/index.md): Product brief without JS\n- [This index](https://health.sassmaker.com/llms.txt)\n',
  indexMd:
    '# App Health\n\nPrivacy-first endpoint health for Node, Go, Cloudflare, and OpenTelemetry services.\n\n## Public boundary\n\n- Aggregate endpoint latency, status, and availability summaries\n- No request bodies, headers, cookies, query values, identities, logs, or stack traces\n- Owner APIs remain authenticated and are not agent-indexed\n\n## Agent entrypoints\n\n- https://health.sassmaker.com/llms.txt\n- https://health.sassmaker.com/api/ai\n- https://health.sassmaker.com/index.md\n',
  catalog: {
    name: 'App Health',
    version: '1',
    url: 'https://health.sassmaker.com',
    llms: 'https://health.sassmaker.com/llms.txt',
    llmsFull: 'https://health.sassmaker.com/llms-full.txt',
    sitemap: 'https://health.sassmaker.com/sitemap.xml',
    robots: 'https://health.sassmaker.com/robots.txt',
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

/**
 * @param {Request} request
 * @returns {Response | null}
 */
export function handleAgentEdge(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  const url = new URL(request.url);
  const path = url.pathname === '' ? '/' : url.pathname;

  if (path === '/llms.txt') {
    return text(AGENT_SURFACE.llmsTxt, 'text/plain; charset=utf-8');
  }
  if (path === '/llms-full.txt' && AGENT_SURFACE.llmsFullTxt) {
    return text(AGENT_SURFACE.llmsFullTxt, 'text/plain; charset=utf-8');
  }
  if (path === '/index.md') {
    return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8');
  }
  if (path === '/api/ai') {
    // Re-bind origin so preview/custom domains stay correct
    const catalog = {
      ...AGENT_SURFACE.catalog,
      url: url.origin,
      llms: `${url.origin}/llms.txt`,
      llmsFull: `${url.origin}/llms-full.txt`,
      sitemap: AGENT_SURFACE.catalog.sitemap
        ? String(AGENT_SURFACE.catalog.sitemap).replace(AGENT_SURFACE.url, url.origin)
        : `${url.origin}/sitemap.xml`,
      surfaces: (AGENT_SURFACE.catalog.surfaces || []).map((s) => ({
        ...s,
        url: s.url ? String(s.url).replace(AGENT_SURFACE.url, url.origin) : s.url,
        md: s.md ? String(s.md).replace(AGENT_SURFACE.url, url.origin) : s.md,
      })),
    };
    return json(catalog);
  }

  // Homepage markdown negotiation
  if ((path === '/' || path === '') && wantsMarkdown(request)) {
    return text(AGENT_SURFACE.indexMd, 'text/markdown; charset=utf-8', {
      Link: '</index.md>; rel="alternate"; type="text/markdown"',
      Vary: 'Accept',
    });
  }

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
