## Shared Fleet Standard

Also read and follow the shared fleet-level agent standard at `../AGENTS.md`. Treat this repository as owned product code: protect production stability, keep changes scoped, verify work, and record durable follow-up tasks when something remains incomplete or blocked.

## Project

- **Stack**: pnpm TypeScript workspace (Vite + React, Cloudflare-compatible Worker, Node/Express SDK) plus a Go 1.22 `net/http` SDK
- **Local dev**: `pnpm install && pnpm run check`; see the commands below for web and Go
- **Deploy**: Not configured in V0; production auth and deployment require a later approved change

## Local commands

Run from the repository root unless noted.

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install TypeScript workspace dependencies. |
| `pnpm run check` | format:check + lint + typecheck + test + build (TypeScript). |
| `pnpm run format` / `pnpm run format:check` | Prettier write / verify. |
| `pnpm run lint` | ESLint (flat config). |
| `pnpm run typecheck` | `tsc --noEmit` across all workspace packages. |
| `pnpm run test` | `vitest run` across all workspace packages. |
| `pnpm run build` | Build all workspace packages (web uses `vite build`). |
| `pnpm --filter @app-health/web dev` | Vite dev server for the operator shell. |
| `cd packages/go && go test ./...` | Go contract tests. |
| `cd packages/go && go vet ./...` | Go vet. |

CI (`.github/workflows/ci.yml`) runs the TypeScript `pnpm run check` job and a
Go job that runs `go test ./...` and `go vet ./...` from `packages/go`.

## Boundaries

- Do not edit `openspec/` or `PROJECT_STATUS.md` from code-change tasks; they
  are owned by the OpenSpec workflow and parent review.
- Do not run `wrangler deploy`, create Cloudflare resources, or touch
  credentials, env files, or production configs. V0 is credential-free and
  local-only.
- Owner APIs fail closed outside `APP_HEALTH_MODE=local`. Ingest returns 501
  in Wave 0; Wave 1 implements authenticated ingest.
- V0 collects only method, normalized route, status, duration, timestamp, and
  optional release. Never add capture of headers, cookies, query values,
  route parameter values, bodies, identity, logs, stacks, or spans.

## Wave status

- Foundation tasks 1.1-1.5 are implemented. Wave 1 (ingest, Node SDK, Go SDK)
  and Wave 2 (dashboard) remain active in
  `openspec/changes/build-endpoint-health-v0/tasks.md`.
