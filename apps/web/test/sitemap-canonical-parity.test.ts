import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PUBLIC_ENTRYPOINTS,
  renderPublicEntrypoint,
} from '../scripts/generate-public-entrypoints.mjs';

const SITE_ORIGIN = 'https://health.sassmaker.com';

/** Extract every <loc> URL from the committed sitemap.xml. */
function readSitemapPaths(): string[] {
  const xml = readFileSync(resolve(process.cwd(), 'public/sitemap.xml'), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => {
    const url = new URL(match[1].trim());
    return url.pathname;
  });
}

describe('sitemap / canonical parity', () => {
  const sitemapPaths = readSitemapPaths();
  const entrypointPaths = PUBLIC_ENTRYPOINTS.map((entry) => entry.path);

  it('lists every public entrypoint path in the sitemap', () => {
    for (const path of entrypointPaths) {
      expect(sitemapPaths).toContain(path);
    }
  });

  it('has a matching public entrypoint for every non-homepage sitemap URL', () => {
    const nonHomePaths = sitemapPaths.filter((path) => path !== '/');
    for (const path of nonHomePaths) {
      expect(entrypointPaths).toContain(path);
    }
  });

  it('gives every sitemap-listed entrypoint a self-canonical, not the homepage canonical', () => {
    const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const homepageCanonical = `${SITE_ORIGIN}/`;

    for (const entry of PUBLIC_ENTRYPOINTS) {
      const html = renderPublicEntrypoint(indexHtml, entry);
      const selfCanonical = `${SITE_ORIGIN}${entry.path}`;

      const canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)" \/>/);
      expect(canonicalMatch).not.toBeNull();
      expect(canonicalMatch?.[1]).toBe(selfCanonical);
      expect(canonicalMatch?.[1]).not.toBe(homepageCanonical);

      const ogUrlMatch = html.match(/<meta property="og:url" content="([^"]+)" \/>/);
      expect(ogUrlMatch).not.toBeNull();
      expect(ogUrlMatch?.[1]).toBe(selfCanonical);
    }
  });

  it('keeps the homepage canonical on the homepage entrypoint only', () => {
    const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const canonicalMatch = indexHtml.match(/<link rel="canonical" href="([^"]+)" \/>/);
    expect(canonicalMatch?.[1]).toBe(`${SITE_ORIGIN}/`);
  });
});
