## Context

App Health currently accepts a strict JSON event batch from its Node and Go
SDKs at `/v1/ingest`. The Worker authenticates an environment-scoped bearer
key, deduplicates events, updates only normalized endpoint inventory and
aggregate performance storage, and marks installation state. Existing OTel
users already generate equivalent HTTP server timing data, but App Health does
not expose an OTLP destination and requiring duplicate middleware adds overhead
and two competing capture policies.

The first compatibility slice must work with the standard Collector
`otlphttp` exporter, whose default trace payload is binary protobuf. It must not
turn App Health into a trace store or weaken the rule that only normalized
endpoint summary fields survive ingest.

## Goals / Non-Goals

**Goals:**

- Let an existing Collector send OTLP/HTTP traces to App Health with a standard
  exporter and the existing environment ingest key.
- Project eligible HTTP server spans into the same internal event and aggregate
  path as official SDK traffic.
- Accept stable and legacy HTTP semantic-convention attribute names during the
  ecosystem migration.
- Preserve bounded bodies, idempotency, hostname isolation, one-time key
  handling, and aggregate-only storage.
- Make trace sampling uncertainty visible in every derived endpoint metric.

**Non-Goals:**

- OTLP/gRPC, logs, profiles, arbitrary trace search, span storage, dependency
  graphs, exception evidence, or forwarding customer telemetry.
- Claiming exact traffic counts or latency distributions from traces.
- OTLP metric ingestion; the standard `http.server.request.duration` histogram
  is the future path to sampling-independent OTel endpoint metrics.
- Production deployment, resource changes, secrets, or a custom Collector
  distribution/plugin.

## Decisions

### Expose the standard `/v1/traces` OTLP/HTTP endpoint

The ingest hostname accepts authenticated POSTs at `/v1/traces`. It supports
binary protobuf and OTLP JSON, returns the matching OTLP export response shape,
and supports bounded gzip request decoding. The route reuses the existing
environment bearer key and host checks, so OTel does not create another
credential or authorization model.

Alternative: publish an App Health Collector exporter. Rejected because a
custom component makes adoption depend on a specific Collector distribution;
the standard OTLP/HTTP exporter already supports endpoints and headers.

### Decode only enough OTLP to project server spans

The Worker uses `@bufbuild/protobuf`'s wire reader for safe protobuf framing and
a small focused traversal of ExportTraceServiceRequest. It materializes only
resource `service.version`, span identity/timestamps/kind, and allowlisted HTTP
attributes. Unknown fields and nested events/links are skipped without being
stored or logged. JSON input is traversed through the same projection rules.

Alternative: add the full OpenTelemetry JavaScript SDK/transformer graph.
Rejected because those packages target telemetry production/export, add a much
larger dependency surface, and do not provide a narrow backend decoder.

### Require a trusted route and project to the existing event shape

Only `SPAN_KIND_SERVER` spans with a string `http.route`, valid method, status,
duration, timestamps, and trace/span identity become endpoint events. Current
attributes (`http.request.method`, `http.response.status_code`) take precedence
over legacy (`http.method`, `http.status_code`). `service.version` becomes the
optional release after existing validation. Concrete `url.path`, `url.full`,
queries, headers, bodies, identities, events, links, stack data, and all other
attributes never enter the internal event.

The event ID is a deterministic UUID-shaped digest of trace ID plus span ID so
Collector retries use the existing bounded D1 deduplication path.

### Carry sampling provenance without a database migration

All trace-derived events carry an internal `upstreamSampled` flag. In-memory
buckets propagate it directly. Analytics Engine stores the flag in an unused
blob column and queries reduce it with a maximum, so existing points remain
compatible and no D1 schema change is required. Endpoint API rows expose
`upstream_sampled: true`, and the dashboard labels their request/error/latency
figures as sampled estimates.

This flag is conservative: OTLP trace payloads cannot prove that the source
stream was complete. A future OTLP metrics path can provide a stronger
provenance level rather than silently upgrading trace-derived values.

### Generate an additive Collector configuration

Setup adds an OpenTelemetry tab containing a standard `otlphttp/app_health`
exporter with the App Health origin and bearer header plus an example traces
pipeline that retains the user's existing exporters. The copy explicitly says
to add App Health to an existing pipeline and warns that arbitrary attributes
are discarded. The raw key remains visible only in the existing one-time setup
state.

## Risks / Trade-offs

- **Trace sampling biases endpoint metrics** → label every trace-derived value
  as sampled and keep health states visibly provisional.
- **Collector semantic conventions vary by version** → support current and
  legacy HTTP attribute aliases with deterministic precedence and tests.
- **OTLP batches are larger than SDK batches** → enforce bounded compressed and
  decompressed bodies, cap projected spans, and return a protocol-valid partial
  success when eligible spans are dropped.
- **Protobuf parsing increases attack surface** → delegate wire primitives to a
  maintained zero-dependency runtime, reject malformed input, and never retain
  the decoded graph.
- **A Collector can export unrelated spans** → filter server-side and document
  an isolated App Health pipeline; unrelated data is ignored and never stored.

## Migration Plan

1. Land contracts, decoder/projector, local route, and compatibility tests.
2. Land OTel setup copy and sampling-aware dashboard states.
3. Validate with a local Collector fixture without credentials.
4. Under separate production approval, deploy the Worker/dashboard and run a
   canary that fans out an existing OTel pipeline.

Rollback removes the new route and setup tab. Existing SDK ingest, storage, and
dashboard rows remain compatible because the new aggregate field is optional.

## Open Questions

- Which first customer pipelines emit stable versus legacy HTTP semantic
  conventions?
- When evidence justifies OTLP metric ingestion, should trace-derived rows be
  replaced or displayed alongside metric-derived rows during overlap?
