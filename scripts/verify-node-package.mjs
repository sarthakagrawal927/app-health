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
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball], {
    cwd: consumerDir,
    stdio: 'inherit',
  });

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
    `import { createAppHealthClient } from '@saas-maker/app-health';\nimport { expressMiddleware } from '@saas-maker/app-health/express';\nif (typeof createAppHealthClient !== 'function' || typeof expressMiddleware !== 'function') process.exit(1);\n`,
  );
  execFileSync(globalThis.process.execPath, ['smoke.mjs'], {
    cwd: consumerDir,
    stdio: 'inherit',
  });
  execFileSync(
    globalThis.process.execPath,
    [
      '-e',
      "const core = require('@saas-maker/app-health'); const adapter = require('@saas-maker/app-health/express'); if (typeof core.createAppHealthClient !== 'function' || typeof adapter.expressMiddleware !== 'function') process.exit(1)",
    ],
    { cwd: consumerDir, stdio: 'inherit' },
  );

  globalThis.console.log(`verified ${packed.filename} from an external ESM and CommonJS consumer`);
} finally {
  rmSync(temporaryDir, { recursive: true, force: true });
}
