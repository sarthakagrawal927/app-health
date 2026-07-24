## Context

The JavaScript SDK is framework-independent at its core but currently exports
only an Express adapter and emits `runtime: node`. Fleet has several Hono
Workers and a smaller set of file-routed Pages Functions. Cloudflare request
lifetimes also differ from Node: delivery work started after a response needs
to be registered with `ExecutionContext.waitUntil`.

The npm package has already passed tarball and external-consumer verification,
but the configured npm identity returns `E401`. GitHub repository publication
is available and can host an immutable release asset without adding a registry,
credential, or production dependency.

## Goals / Non-Goals

**Goals:**

- Make Hono Worker instrumentation a middleware registration plus a lazy
  environment-key client resolver.
- Make Pages Function instrumentation a wrapper with an explicit trusted route
  template.
- Preserve application responses, errors, and the existing six-field privacy
  contract.
- Mark Worker-origin telemetry accurately throughout ingest and setup state.
- Produce a verified public package artifact and consume that exact immutable
  artifact in one Fleet Worker.

**Non-Goals:**

- Capture raw Cloudflare traces, logs, headers, URLs, identities, or bodies.
- Infer Pages route templates from concrete request URLs.
- Add automatic fleet-wide credentials or deploy every consumer in this
  change.
- Replace the existing OTLP/HTTP path or add an OpenTelemetry SDK dependency.
- Introduce a new production service, database, or paid Cloudflare feature.

## Decisions

### Keep adapters as optional package subpaths

`@saas-maker/app-health/hono` and `/pages` will be separate build entries.
Hono is an optional peer dependency, while the Pages wrapper uses a small
structural context type and adds no Cloudflare runtime package. This keeps the
root client usable without either framework. Bundling framework code into the
root export was rejected because it would enlarge and couple every consumer.

### Resolve Hono clients lazily from request context

The Hono adapter accepts either a client or a resolver returning a client or
`null`. Worker consumers can read an optional environment binding inside the
resolver and become a no-op when it is absent. This avoids source credentials
and avoids constructing an invalid client during module evaluation.

### Use only framework-owned route identity

Hono middleware reads the matched `routePath` after routing. Pages wrappers
require the caller to supply a static route template alongside the handler.
Unmatched, invalid, or concrete-looking routes are dropped by the shared
normalizer. Reading `req.path`, URLs, params, or query data as a fallback is
forbidden.

### Register delivery with `waitUntil`

After recording, adapters call `client.flush()` and register the resulting
promise with the framework/platform execution context. `record()` remains
non-blocking and the response is never delayed; the client coalesces concurrent
flushes. Worker consumers disable the timer because request-scoped
`waitUntil` is the reliable lifetime boundary. Timer-only delivery was rejected
because a Worker isolate may be suspended after returning a response.

### Add `worker` to the existing runtime enum

The change extends the current runtime discriminator rather than overloading
`node`. Storage already treats runtime as an aggregate dimension, so the
migration is validation and presentation only; no D1 schema change is needed.

### Use a GitHub Release asset as the authenticated-registry fallback

The package version advances to `0.2.1`. The existing package verification
builds a `.tgz`, tests its exports from an external fixture, and the release
attaches that exact artifact to tag `node-v0.2.1`. Consumers pin the immutable
release URL. npm remains the preferred friendly install path and can publish
the same version later if authentication becomes available. A moving branch or
raw repository dependency was rejected because it is not immutable.

### Pilot Free AI without provisioning a credential in source

Free AI is an existing Hono Worker with high-value API routes and already has
deployment discipline. It will depend on the immutable release asset, add an
optional `APP_HEALTH_INGEST_KEY` binding type, and register the middleware. The
deployed product remains functional when the binding is absent. Creating or
uploading the ingest secret remains a separate owner operation.

## Risks / Trade-offs

- [Flushing after each Worker response can reduce batch size] → concurrent
  flushes remain coalesced and correctness/lifetime safety takes precedence;
  measure before adding a bounded wait window.
- [A Hono error handler can translate a thrown error after middleware sees it]
  → record the thrown path as 500 and rethrow without changing framework error
  handling; successful returned responses use their final status.
- [Callers could pass a concrete Pages route] → shared normalization and tests
  reject unsafe route identities; examples use compile-time constants.
- [GitHub release URLs are less ergonomic than npm] → document both paths and
  retain npm as the preferred channel once publisher authentication works.
- [Pilot deployment lacks telemetry until a secret is configured] → treat
  code integration and live connection as separate evidence; never place the
  key in source or release artifacts.

## Migration Plan

1. Extend contracts, ingest validation, dashboard runtime copy, and tests.
2. Add Hono and Pages exports, package verification, examples, and privacy
   tests.
3. Run the full TypeScript and Go repository checks plus strict OpenSpec
   validation.
4. Commit and push the green App Health release, create tag `node-v0.2.1`, and
   attach the verified package tarball to a public GitHub Release.
5. Install the immutable artifact in Free AI, add the optional middleware
   integration, validate, commit, push, deploy through its existing guard, and
   smoke the public service.
6. Roll back the consumer by removing the middleware/dependency or leaving the
   optional binding unset. Roll back package adoption by pinning the prior
   version; the App Health ingest additions are backward-compatible.

## Open Questions

- Whether npm publisher authentication should later be restored for the
  `@saas-maker` scope; this does not block GitHub-based adoption.
- Which additional Fleet Workers should receive environment-scoped keys after
  the pilot demonstrates live traffic.
