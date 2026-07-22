## Context

The production ingest API and both SDK delivery cores are proven, but neither
SDK has a real consumer installation path. The Node package exports TypeScript
workspace source and depends on a private workspace contracts package. The Go
module declares a placeholder module path, and its generic `net/http`
middleware cannot read Echo's route template without an adapter.

The first consumers use Express and Echo. Supporting those two well is more
valuable than claiming generic framework support with concrete-path fallback
or copy-pasted instrumentation.

## Goals / Non-Goals

**Goals:**

- Produce a packable Node 20+ package under the existing `@saas-maker` npm
  publisher scope.
- Keep the Node core independent from Express and expose Express through a
  dedicated subpath.
- Give the Go module a real repository path and add an Echo v5 middleware that
  records `Context.Path()` after routing.
- Preserve the existing privacy boundary, asynchronous fail-open delivery,
  bounded queues, retries, diagnostics, flush, and shutdown behavior.
- Make the privacy boundary structural: official adapters use matched route
  templates, unmatched concrete paths are dropped, and release tags use a
  narrow machine-safe character set.
- Prove built/packed artifacts from outside workspace source resolution.
- Put exact Express and Echo install/setup snippets in the dashboard.

**Non-Goals:**

- Hapi, Fastify, Koa, Nest, Gin, Chi, Fiber, or other adapters.
- Automatic source-code route discovery, traces, logs, headers, payloads, user
  identity, or request parameter capture.
- Making the GitHub repository public or inventing npm credentials.
- Automatically publishing on every `main` push.

## Decisions

### Publish one Node package with a framework subpath

The public package name is `@saas-maker/app-health`. The root export contains
the framework-neutral batching client; `@saas-maker/app-health/express`
contains the optional Express middleware. Express remains an optional peer, so
core consumers do not install it.

`tsup` builds ESM, CommonJS, and bundled declaration output. It bundles the
private workspace contracts dependency into the artifact so consumers install
one package and never resolve `workspace:*`. The package includes only `dist`,
metadata, and documentation, and `npm pack --dry-run` plus an external fixture
prove the tarball.

Alternative: publish the contracts package separately. Rejected because it
creates a second public package with no independent user value and a versioning
surface that can drift.

### Keep Go core and Echo adapter in one real module

The module path becomes
`github.com/sarthakagrawal927/app-health/packages/go`. The Echo adapter lives at
the `/echo/v5` package path and imports Echo v5. Core delivery remains written
against the standard library. Go consumers of the private repository use
normal `GOPRIVATE` and GitHub authentication until repository visibility is
separately changed.

The core client exposes one bounded `Record` operation for adapters. The Echo
middleware records after handler completion, uses `Context.Path()` rather than
the concrete URL, preserves returned errors, derives status from committed
responses or `echo.HTTPError`, records panic as 500, and re-panics unchanged.

Alternative: wrap only Echo's `http.Handler`. Rejected because the standard
request does not reliably expose Echo's matched template and would silently
fall back to high-cardinality concrete paths.

### Keep the app-facing Echo contract explicit and tiny

Echo consumers install telemetry with one `Install` call and a config containing
only `Enabled`, `Environment`, `Key`, and `Project`. `Enabled` is supplied by the
application, so the SDK does not impose process-variable names or environment
matching policy. The production ingest endpoint, bounded queue, batching,
timeouts, retries, privacy filtering, and graceful flush remain SDK defaults.

An absent key or disabled config is a no-op. This preserves fail-open startup
while making every activation input visible at the call site.

Alternative: `InstallFromEnvironment` with fixed `APP_HEALTH_*` names. Rejected
because it hides the real contract, couples applications to SDK-owned variable
names, and makes a three-line integration harder to audit.

### Releases remain explicit and guarded

Node starts at `0.1.0`; Go uses a submodule tag such as
`packages/go/v0.1.0`. Local builds, tests, tarball inspection, and package
consumer fixtures run before any publication. npm publication occurs only when
`npm whoami` succeeds for the `@saas-maker` scope. The repository is tagged
only after the exact commit is green and pushed.

### Dashboard snippets show only verified paths

The setup view offers Express and Echo tabs, uses the configured ingest origin,
and includes the one-time key only while that key is already visible. It does
not advertise unsupported frameworks as automatic integrations.

### Prefer omission over heuristic obfuscation

Request-derived strings are not general metadata. Express and Echo adapters
record only their matched route templates; generic Go middleware records only
a resolver or ServeMux pattern. If no trusted template exists, the event is
dropped. Query strings, headers, cookies, bodies, parameter values, identities,
logs, stacks, and spans are never read. Optional release tags are accepted only
when they match a bounded release-token character set.

This is safer than trying to detect every possible email, name, slug, token, or
customer identifier after capture. Numeric/UUID normalization remains a
defense-in-depth utility for explicitly supplied templates, not permission to
send concrete fallback paths.

## Risks / Trade-offs

- **npm authentication is absent locally** → Build and pack the release, but do
  not fabricate credentials or claim publication; report the one external gate.
- **The GitHub repository is private** → Document `GOPRIVATE`; do not change
  visibility without separate approval.
- **Echo error status is finalized outside middleware** → Interpret committed
  response status and `echo.HTTPError`, with a 500 fallback, and cover both in
  tests.
- **A public Record API can be misused with concrete paths** → Validate through
  the same normalizers, reject obvious unsafe strings, and document that
  adapters must pass route templates; official adapters never pass unmatched
  concrete paths.
- **Bundling contracts can hide dependency drift** → Consumer tests parse a
  real packed package and existing contract fixtures remain canonical.

## Migration Plan

1. Add distribution metadata/build output and external package smoke tests.
2. Change the Go module path, add the public adapter hook and Echo package, then
   run all Go tests and vet.
3. Update examples, dashboard snippets, README, and project status.
4. Push the exact green commit and deploy the dashboard through the existing
   guard.
5. Publish npm and create the Go submodule tag only when their external release
   prerequisites pass. Rollback is a package patch release and Worker version
   rollback; ingest contracts do not change.

## Open Questions

None for implementation. npm authentication and public GitHub visibility are
external release-state checks, not product-design questions.
