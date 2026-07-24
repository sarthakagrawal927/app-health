import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new globalThis.URL('..', import.meta.url)));
const packageDir = join(root, 'packages', 'node');
const temporaryDir = mkdtempSync(join(tmpdir(), 'app-health-node-package-'));

try {
  const packOutput = execFileSync('npm', ['pack', '--json', '--pack-destination', temporaryDir], {
    cwd: packageDir,
    encoding: 'utf8',
  });
  const packResult = JSON.parse(packOutput);
  const packed = Array.isArray(packResult)
    ? packResult[0]
    : packResult?.filename
      ? packResult
      : Object.values(packResult).find((result) => result?.filename);
  if (!packed?.filename || !Array.isArray(packed.files)) {
    throw new Error('npm pack did not return a package manifest');
  }

  const paths = packed.files.map((file) => file.path);
  const required = [
    'dist/index.js',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/express.js',
    'dist/express.cjs',
    'dist/express.d.ts',
    'dist/hono.js',
    'dist/hono.cjs',
    'dist/hono.d.ts',
    'dist/pages.js',
    'dist/pages.cjs',
    'dist/pages.d.ts',
  ];
  for (const path of required) {
    if (!paths.includes(path)) throw new Error(`packed package is missing ${path}`);
  }
  if (paths.some((path) => path.startsWith('src/') || path.includes('tsconfig'))) {
    throw new Error('packed package leaked workspace source or TypeScript configuration');
  }

  const consumerDir = join(temporaryDir, 'consumer');
  mkdirSync(consumerDir);
  writeFileSync(
    join(consumerDir, 'package.json'),
    JSON.stringify({ name: 'app-health-consumer-smoke', private: true, type: 'module' }),
  );
  const tarball = join(temporaryDir, packed.filename);
  execFileSync(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball, 'hono@4.12.18'],
    {
      cwd: consumerDir,
      stdio: 'inherit',
    },
  );

  const installedManifest = JSON.parse(
    readFileSync(
      join(consumerDir, 'node_modules', '@saas-maker', 'app-health', 'package.json'),
      'utf8',
    ),
  );
  const serializedManifest = JSON.stringify(installedManifest);
  if (serializedManifest.includes('workspace:') || installedManifest.dependencies) {
    throw new Error('published manifest contains a workspace-only runtime dependency');
  }

  writeFileSync(
    join(consumerDir, 'smoke.mjs'),
    `import { Hono } from 'hono';
import { createAppHealthClient } from '@saas-maker/app-health';
import { expressMiddleware } from '@saas-maker/app-health/express';
import { honoMiddleware } from '@saas-maker/app-health/hono';
import { withPagesFunctionHealth } from '@saas-maker/app-health/pages';
if ([createAppHealthClient, expressMiddleware, honoMiddleware, withPagesFunctionHealth].some((value) => typeof value !== 'function')) process.exit(1);
const events = [];
const waits = [];
const client = { record: (event) => events.push(event), flush: async () => {}, close: async () => {}, diagnostics: () => ({}) };
const app = new Hono();
app.use('*', honoMiddleware({ client }));
app.get('/users/:id', (context) => context.text('ok'));
const response = await app.request('/users/private', undefined, {}, { waitUntil: (promise) => waits.push(promise), passThroughOnException() {} });
if (response.status !== 200 || events[0]?.route !== '/users/:id' || waits.length !== 1) process.exit(1);
const pages = withPagesFunctionHealth({ client, route: '/pages/:id' }, async () => new Response('ok', { status: 201 }));
const pageResponse = await pages({ request: new Request('https://example.test/pages/private'), env: {}, params: {}, data: {}, next: async () => new Response(), waitUntil: (promise) => waits.push(promise) });
if (pageResponse.status !== 201 || events[1]?.route !== '/pages/:id') process.exit(1);
`,
  );
  execFileSync(globalThis.process.execPath, ['smoke.mjs'], {
    cwd: consumerDir,
    stdio: 'inherit',
  });
  execFileSync(
    globalThis.process.execPath,
    [
      '-e',
      "const core = require('@saas-maker/app-health'); const express = require('@saas-maker/app-health/express'); const hono = require('@saas-maker/app-health/hono'); const pages = require('@saas-maker/app-health/pages'); if ([core.createAppHealthClient, express.expressMiddleware, hono.honoMiddleware, pages.withPagesFunctionHealth].some((value) => typeof value !== 'function')) process.exit(1)",
    ],
    { cwd: consumerDir, stdio: 'inherit' },
  );

  globalThis.console.log(`verified ${packed.filename} from an external ESM and CommonJS consumer`);
} finally {
  rmSync(temporaryDir, { recursive: true, force: true });
}
