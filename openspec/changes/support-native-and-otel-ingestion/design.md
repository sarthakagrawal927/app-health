## Context

App Health currently accepts a small native JSON event batch from its Node and Go SDKs, authenticates with one environment-scoped ingest key, and projects each request into a normalized endpoint identity, aggregate latency/status data, and a bounded failure row for 4xx/5xx responses. The product intentionally excludes traces, logs, payloads, identity, and general observability workflows.

The second integration path must let an application that already emits OpenTelemetry HTTP server spans use App Health without mounting duplicate middleware. Both paths must converge before storage so the dashboard, privacy guarantees, retention, and cost profile do not diverge.

## Goals / Non-Goals

**Goals:**

- Offer exactly two first-class paths: Native SDK and OpenTelemetry.
- Make native setup one initialization plus one middleware registration.
- Make existing OpenTelemetry setup configuration-only through OTLP/HTTP traces.
- Produce identical App Health endpoint metrics, health states, installation state, and failure rows from either source.
- Preserve the current key scope, fail-open behavior, aggregate-only success storage, bounded failure retention, and Cloudflare-first deployment.
- Reject or discard every OpenTelemetry field outside the safe App Health projection before durable writes.

**Non-Goals:**

- General-purpose trace search, service maps, logs, arbitrary metrics, baggage, profiles, exception bodies, stack traces, or alerting.
- Replacing the OpenTelemetry Collector or an application's existing observability backend.
- Accepting client, producer, consumer, internal, database, RPC, or messaging spans.
- Adding framework-specific integrations beyond Express, Echo, and Go `net/http` for the native lane.
- Adding another paid service or Cloudflare subscription.

## Decisions

### 1. Both inputs converge on one canonical safe observation

The Worker will introduce an internal `SafeEndpointObservation` containing only a stable event identifier, timestamp, method, normalized route, status code, integer duration milliseconds, optional release, and source (`node`, `go`, or `otel`). Native `EventV1` batches validate into this shape. Accepted OpenTelemetry server spans map into the same shape before deduplication, inventory, failure retention, and Analytics Engine aggregation.

This keeps one implementation of storage, health calculation, and retention. Separate native and OpenTelemetry storage paths were rejected because they would drift and make parity unprovable.

### 2. The ingest key remains the routing authority

The bearer ingest key continues to resolve the durable app and environment. Native `project` and `environment` configuration and OpenTelemetry `service.name` and deployment-environment resource attributes are diagnostic labels that may be checked for mismatches, but they never choose storage scope.

One key works with either supported lane. A key cannot send data to another app or environment by changing payload attributes.

### 3. Native setup has three required values and safe defaults

The operator-facing native configuration is `key`, `project`, and `environment`. The production ingest URL defaults to `https://ingest.sassmaker.com/v1/ingest`; release, endpoint override, explicit disable, batching, and shutdown tuning remain optional advanced settings.

Node requires one client initialization and one Express middleware registration. Go requires one client construction and one Echo or `net/http` middleware registration, plus bounded shutdown where the host already has graceful shutdown. No route registry, startup flag, global singleton, or mandatory environment variable is required.

Existing explicit configuration remains source-compatible during migration. A breaking SDK release is not required.

### 4. OpenTelemetry integrates through a direct OTLP/HTTP traces receiver

The ingest hostname will expose authenticated `POST /v1/traces` using OTLP/HTTP. It will accept the standard binary Protobuf and JSON Protobuf content types and gzip content encoding, return protocol-shaped success or partial-success responses, and apply compressed-body, expanded-body, span-count, and processing limits.

An already-instrumented service configures its traces endpoint and authorization header; it does not install App Health middleware or an App Health-specific span processor. Metrics and logs continue to flow to any existing backend. App Health does not expose `/v1/metrics` or `/v1/logs` as supported ingestion products.

A small Protobuf runtime plus generated message definitions pinned to the official `opentelemetry-proto` schema is preferred over handwritten decoding. The implementation agent must verify Worker compatibility and bundle impact before adding the production dependency.

### 5. Only HTTP server spans with a normalized route are eligible

The mapper accepts only `SPAN_KIND_SERVER` spans with all of:

| App Health field | OpenTelemetry source |
|---|---|
| method | stable `http.request.method` |
| normalized route | stable `http.route` |
| status | stable `http.response.status_code` |
| duration | span end time minus start time |
| timestamp | span end time |
| release | `service.version`, when present |
| source | constant `otel` |

The receiver never falls back from `http.route` to `url.path`, `url.full`, span name, or another concrete value. A span missing a safe route, valid status, valid timing, or supported semantic-convention mapping is rejected from App Health with a bounded partial-success count.

Legacy HTTP semantic-convention aliases may be recognized only through an explicit, tested compatibility map. They must satisfy the same normalized-route rule and are never persisted as arbitrary attributes.

### 6. OpenTelemetry identifiers support retry deduplication but are never stored

The mapper derives a deterministic internal UUID-shaped event ID from the key-resolved scope plus trace ID and span ID using SHA-256. The digest is used only for bounded deduplication and failure identity; raw trace ID, span ID, parent ID, links, events, and attributes are discarded. Re-exporting the same span therefore does not double-count metrics.

The design avoids storing or displaying distributed-tracing identifiers because App Health does not provide trace navigation and retaining them would expand the privacy contract without product value.

### 7. Partial success is explicit and bounded

Valid eligible spans in a mixed OTLP export are accepted even when unrelated or unsafe spans are ignored. The response reports rejected span count and one bounded reason summary. Invalid authentication, unsupported content encoding, malformed Protobuf/JSON, or body-limit violations reject the request without partial writes.

Native batch behavior remains unchanged. Both paths are idempotent and feed the same bounded Analytics Engine point limit.

### 8. The dashboard teaches only the two supported paths

App/key setup presents a two-choice installation surface: Native SDK or OpenTelemetry. Native shows the relevant Express/Echo/`net/http` snippet. OpenTelemetry shows endpoint/header configuration and the required HTTP server semantic fields. Both use the same key, project, environment, installation-status polling, dashboard, and Data received view.

The transparency view distinguishes fields used for the safe projection from fields immediately discarded. It does not imply that App Health stores or exposes complete spans.

## Risks / Trade-offs

- **Semantic-convention drift** → Pin and test a supported stable convention version, keep legacy aliases explicit, and never infer routes from raw paths.
- **OTLP payloads increase Worker CPU or memory** → Enforce compressed and expanded body bounds, span-count limits, streaming decompression where practical, and benchmark representative payloads before deploy.
- **Generated Protobuf code increases bundle size** → Generate only trace/resource/common message types needed for server-span mapping and measure startup/bundle size in CI.
- **Sampling before App Health loses request-level failures** → Document that parity applies to spans actually exported to App Health; recommend an unsampled or appropriately sampled App Health trace exporter when exact failure capture is required.
- **One exporter sends unsupported signals** → Provide signal-specific trace configuration and protocol-correct unsupported responses; do not silently claim logs or metrics support.
- **Project/environment labels disagree with key scope** → Keep the key authoritative, surface bounded diagnostics, and never reroute data based on resource attributes.
- **Native and OpenTelemetry behavior drifts** → Maintain source-equivalence fixtures and run both through the same canonical pipeline and dashboard assertions.

## Migration Plan

1. Add canonical observation contracts and source-equivalence fixtures without changing production routes.
2. Add backward-compatible minimal native constructors and update Express/Echo/`net/http` examples.
3. Implement and locally test the OTLP mapper, protocol handling, limits, deduplication, and privacy rejection matrix.
4. Add the setup/transparency UI and documentation for exactly two paths.
5. Deploy the OTLP route disabled, run native regression and synthetic OTLP canaries against production-equivalent bindings, then enable it through the existing manual deploy process.
6. Verify both sources produce equivalent endpoint and failure results with no prohibited D1 or Analytics Engine fields.

Rollback disables the OTLP route and restores the previous Worker version. Native `/v1/ingest`, existing keys, stored aggregates, and dashboard behavior remain valid throughout.

## Open Questions

No product-scope questions are blocking implementation. The implementation agent must record the selected Protobuf runtime and its measured Worker bundle/startup cost before dependency approval.
