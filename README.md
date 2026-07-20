# app-health

App Health V0 gives a Go or Node application an ingest key and shows how every
observed endpoint is performing. It includes Express and `net/http` SDKs,
aggregate-only ingest, and a responsive local operator dashboard.

## Repository layout

```
apps/
  web/      Vite + React setup flow and observed-endpoint dashboard
  worker/   Cloudflare Worker entry point + in-memory dev adapter
packages/
  contracts/  V1 event, aggregate, app/key, installation-status, query
              contracts with zod runtime validation and canonical fixtures
  node/       @app-health/node client and optional Express middleware
  go/         Go 1.22 client and net/http middleware (stdlib only)
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
| Go standard library                                                                                       | packages/go                                          | The Go V0 contract module uses stdlib only; no third-party Go modules.                                      |

No Cloudflare resources are provisioned. No `wrangler deploy`, no D1, no R2,
no Queues, no credentials, no env files. The worker runs against an in-memory
adapter in `APP_HEALTH_MODE=local`.

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

`packages/go` mirrors the same types, bounds, validators, and fixtures in Go
using only the standard library.

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

Percentiles are derived from merged fixed latency-histogram counts, never by
averaging bucket percentiles. Bucket bounds are listed in
`packages/contracts/src/constants.ts` and mirrored in
`packages/go/contracts.go`.

## Privacy boundary

V0 collects **only** method, normalized route, status code, duration,
timestamp, and optional release. It MUST NOT collect headers, cookies, query
values, route parameter values, request or response bodies, user identity,
logs, stack traces, or spans. The contract validators reject unknown fields;
both SDKs enforce the same boundary at capture time.

## No-deploy / no-production-auth boundary

- Owner APIs (`POST /v1/apps`, `GET /v1/endpoints`, `GET /v1/installation/status`)
  fail closed with HTTP 403 outside `APP_HEALTH_MODE=local`.
- `POST /v1/ingest` authenticates an environment-scoped key and writes only
  one-minute aggregate buckets through the local adapter.
- No `wrangler deploy`, no Cloudflare resource creation, no credentials, no
  env files, no production identity adapter. Production auth selection and
  deployment are explicit later work tracked in `PROJECT_STATUS.md`.

## Current boundary

The endpoint-only V0 is implemented and locally proven. Production identity,
durable Cloudflare resources, deployment, alerts, traces, logs, and broader
incident workflows remain explicitly out of scope.
