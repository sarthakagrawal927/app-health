# app-health

App Health V0 gives a Go or Node application an ingest key and shows how every
observed endpoint is performing. It includes Express, Echo, and `net/http` SDKs,
aggregate-only ingest, and a responsive operator dashboard. Local development
is credential-free; the production path targets Cloudflare D1 and Workers
Analytics Engine with a dedicated single-owner Worker secret.

## Repository layout

```
apps/
  web/      Vite + React setup flow and observed-endpoint dashboard
  worker/   Cloudflare Worker + D1/Analytics Engine production adapters
packages/
  contracts/  V1 event, aggregate, app/key, installation-status, query
              contracts with zod runtime validation and canonical fixtures
  node/       @saas-maker/app-health client and Express adapter
  go/         Go 1.22 client with net/http and Echo adapters
openspec/changes/build-endpoint-health-v0/   Active V0 OpenSpec change
```

## Runtime dependencies (and why)

V0 keeps the dependency surface small because both SDKs eventually run inside
customer request paths.

| Dependency                                                                                                | Where                                                | Why                                                                                                         |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `zod`                                                                                                     | packages/contracts                                   | Runtime validation of v1 ingest/query payloads. Single, well-vetted library; reused by worker and node SDK. |
| `react`, `react-dom`                                                                                      | apps/web                                             | Operator dashboard shell. Required by the Vite + React stack.                                               |
| `vite`, `@vitejs/plugin-react`                                                                            | apps/web (dev)                                       | Local dev server and production build of the operator shell.                                                |
| `vitest`, `jsdom`, `@testing-library/react`                                                               | apps/web (dev)                                       | Component tests for the dashboard shell.                                                                    |
| `vitest`                                                                                                  | packages/contracts, packages/node, apps/worker (dev) | Contract and worker unit tests.                                                                             |
| `@cloudflare/workers-types`                                                                               | apps/worker (dev)                                    | Type definitions for the Worker `fetch` handler. No runtime dependency.                                     |
| `typescript`, `eslint`, `prettier`, `typescript-eslint`, `@eslint/js`, `eslint-config-prettier`, `rimraf` | root (dev)                                           | Shared typecheck, lint, format, and clean tooling.                                                          |
| `tsup`                                                                                                    | packages/node (dev)                                  | Produces the public SDK's ESM, CommonJS, and declaration artifacts.                                         |
| Go standard library                                                                                       | packages/go core                                     | Bounded queue, delivery, diagnostics, and `net/http` middleware.                                            |
| `github.com/labstack/echo/v4`                                                                             | packages/go/echo                                     | Framework route-template and response/error integration; v4.12 is the Go 1.22-compatible minimum.           |

`APP_HEALTH_MODE=local` uses the in-memory adapter. Production mode requires a
bound D1 database, Analytics Engine dataset, read-scoped query-token secret,
owner-authentication secret, and the approved hostnames before it will serve
owner data. The production dashboard keeps the entered owner key in page memory
only and requires it again after refresh.

## Local commands

All commands run from the repository root unless noted.

### Install

```bash
pnpm install
```

### TypeScript checks (format, lint, typecheck, test, build)

```bash
pnpm run check            # format:check + lint + typecheck + test + build
pnpm run format           # write prettier formatting
pnpm run format:check     # verify prettier formatting
pnpm run lint             # eslint
pnpm run typecheck        # tsc --noEmit across all workspace packages
pnpm run test             # vitest run across all workspace packages
pnpm run build            # build all workspace packages (web -> vite build)
```

### Go (packages/go)

```bash
cd packages/go
go test ./...
go vet ./...
```

## Install the SDKs

### Express on Node.js 20+

```bash
npm install @saas-maker/app-health
```

```ts
import { createAppHealthClient } from '@saas-maker/app-health';
import { expressMiddleware } from '@saas-maker/app-health/express';

const appHealth = createAppHealthClient({
  key: process.env.APP_HEALTH_INGEST_KEY!,
  endpoint: 'https://ingest.sassmaker.com/v1/ingest',
  release: process.env.APP_VERSION,
});
app.use(expressMiddleware({ client: appHealth }));

// During graceful shutdown:
await appHealth.close();
```

### Echo on Go 1.22+

```bash
go get github.com/sarthakagrawal927/app-health/packages/go/echo/v5@v5.1.0
```

```go
cleanup := apphealthechov5.Install(e, apphealthechov5.Config{
	Enabled:     true,
	Environment: "staging",
	Key:         os.Getenv("APP_HEALTH_INGEST_KEY"),
	Project:     "orders-api",
})
defer cleanup()
```

The Echo installer owns the production ingest endpoint, batching, retries,
privacy filtering, and bounded shutdown. Set `Enabled` from application policy;
an empty key or disabled config is a no-op. Use `appHealth.diagnostics()` for
Node delivery counters.
Complete runnable examples live in `examples/go-echo` and `examples/node`.
The Echo example intentionally consumes a tagged module without a
local `replace`, so it also acts as a release-distribution canary.

## SDK release procedure

SDK releases are explicit rather than automatic:

```bash
pnpm --filter @saas-maker/app-health run pack:verify
npm whoami
npm publish packages/node --access public

git tag packages/go/echo/v5.1.0
git push origin packages/go/echo/v5.1.0
```

Only publish or tag the exact pushed commit after repository and consumer
checks pass. npm publication is skipped when publisher authentication is not
available.

### Web dev server

```bash
pnpm --filter @app-health/web dev
```

Vite serves the credential-free, in-memory Worker API on the same local origin,
so setup, ingest, installation checks, and endpoint queries work without a
deployment. Set `VITE_APP_HEALTH_API` only when pointing the UI at another V1
API implementation.

For a populated local view, open `/?demo=populated`. This development-only
route uses the seeded project and never exposes its key.

## UI evidence

Current browser captures are checked in under `docs/screenshots`:

| State               | Desktop                                             | Mobile                                             |
| ------------------- | --------------------------------------------------- | -------------------------------------------------- |
| Setup               | [setup](docs/screenshots/setup-desktop.png)         | [setup](docs/screenshots/setup-mobile.png)         |
| Waiting for traffic | [waiting](docs/screenshots/waiting-desktop.png)     | [waiting](docs/screenshots/waiting-mobile.png)     |
| Populated endpoints | [populated](docs/screenshots/populated-desktop.png) | [populated](docs/screenshots/populated-mobile.png) |

## V1 contract surface

`packages/contracts` exposes:

- `EventV1`, `EventBatchV1`, `validateBatch` — ingest payload and runtime
  validation with field bounds (event_id UUID v4, method uppercase A-Z,
  route starts with `/` and ≤ 256 chars, status 100-599, duration 0-600000ms,
  batch ≤ 1000 events, schema_version `v1`).
- `EndpointAggregateV1`, `EndpointQueryRequestV1`, `EndpointQueryResponseV1`,
  `BucketV1` — query response, query request, and one-minute aggregate bucket.
- `AppV1`, `EnvironmentV1`, `KeyRecordV1`, `KeyDisplayV1`,
  `CreateAppRequestV1`, `CreateAppResponseV1` — app/key setup.
- `InstallationStatusV1` — installation verification.
- `healthState` — deterministic health calculation.
- `nodeBatchFixture`, `goBatchFixture`, `areEndpointEquivalent` — canonical
  Node and Go fixtures with equivalent endpoint summaries.
- `SEED_BUCKETS`, `seededAggregateResponse`, `mergeBuckets`,
  `approximatePercentiles` — seeded endpoint metrics for the in-memory dev
  adapter.

`packages/go` mirrors the same types, bounds, validators, and fixtures in Go.
Its core and `net/http` middleware use only the standard library; the `/echo`
subpackage adds Echo v4 integration.

## Observed-endpoint semantics

The dashboard lists **observed** endpoints only. An endpoint appears once it
has received at least one instrumented request. Source-code route inventory is
not shown because uncalled routes cannot be inferred consistently across Node
and Go runtimes.

### Health states (deterministic, not configurable)

- `insufficient-data` — fewer than 20 requests in the selected window.
- `unhealthy` — error rate ≥ 5% or p95 ≥ 2000 ms.
- `degraded` — error rate ≥ 1% or p95 ≥ 1000 ms.
- `healthy` — below both degraded thresholds.

Percentiles are approximate in production because Analytics Engine may sample
high-volume indexes. Queries weight every count by `_sample_interval`, then
derive percentiles from merged fixed latency-histogram counts, never by
averaging bucket percentiles. Bucket bounds are listed in
`packages/contracts/src/constants.ts` and mirrored in
`packages/go/contracts.go`. A normalized D1 inventory ensures rare endpoint
identities remain visible even when Analytics Engine omits a sampled metric row;
the dashboard shows those metric values as unavailable, never as false zeros.

## Privacy boundary

V0 collects **only** method, normalized route, status code, duration,
timestamp, and optional release. It MUST NOT collect headers, cookies, query
values, route parameter values, request or response bodies, user identity,
logs, stack traces, or spans. The contract validators reject unknown fields;
both SDKs enforce the same boundary at capture time.

## Production boundary

- `health.sassmaker.com` is the private owner-key-protected dashboard and owner API.
- `ingest.sassmaker.com/v1/ingest` accepts only environment-scoped bearer keys.
- D1 stores control-plane records, bounded event-ID deduplication, and only the
  normalized endpoint identity plus first/last seen; Analytics Engine stores
  approved aggregate endpoint dimensions and counts.
- Direct `workers.dev` access is disabled. Missing bindings, owner or query
  credentials, or hostname settings fail closed.
- The release uses the account's existing Workers subscription. It does not
  activate Zero Trust or another Cloudflare subscription.

## Current boundary

The endpoint-only V0 is live on Cloudflare with both approved hostnames, D1,
Analytics Engine, and owner/ingest key boundaries. Real Node and Go canaries
proved creation, key handoff, ingest, connected state, and normalized endpoint
inventory. Alerts, traces, logs, and broader incident workflows remain
explicitly out of scope.
