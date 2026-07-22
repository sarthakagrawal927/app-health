## 1. Node package distribution

- [x] 1.1 Rename and version the Node package as `@saas-maker/app-health` with root and `/express` exports, public package metadata, and built-only files
- [x] 1.2 Add a reproducible ESM/CommonJS/declaration build that bundles the private contracts implementation without bundling Express
- [x] 1.3 Update the Express example and package tests to consume the public exports
- [x] 1.4 Add tarball-content and external-consumer smoke tests that reject workspace-only dependencies

## 2. Go Echo integration

- [x] 2.1 Change the Go module to the real private GitHub path and update internal consumers
- [x] 2.2 Add a validated non-blocking public record operation for framework adapters
- [x] 2.3 Implement Echo v4 middleware with exact route templates, final statuses, error and panic preservation, and no sensitive capture
- [x] 2.4 Add Echo integration, privacy, outage, and response-preservation tests plus an Echo example
- [x] 2.5 Replace implicit environment installation with the explicit four-field Echo config, update consumer snippets, and prove enabled and disabled behavior

## 3. Setup experience and documentation

- [x] 3.1 Replace generic Node/Go setup copy with verified Express and Echo installation snippets using the production ingest origin
- [x] 3.2 Add dashboard tests for framework switching, one-time-key handling, and copy-ready package paths
- [x] 3.3 Update README, project status, and package documentation with install, shutdown, diagnostics, private-Go-module, and release instructions
- [x] 3.4 Harden Node and Go string handling so official adapters drop unmatched concrete paths, unsafe release strings are omitted, privacy tests cover private slugs, and batching remains asynchronous and bounded

## 4. Verification and release

- [x] 4.1 Run formatting, lint, TypeScript checks, Node package consumer tests, Go tests/vet, SDK benchmarks, and strict OpenSpec validation
- [x] 4.2 Commit and push the exact green change, wait for matching CI, run the deploy guard, deploy the setup UI, and smoke both live snippets
- [x] 4.3 Run the guarded npm publication and Go submodule tag steps only if their authentication and repository prerequisites pass; otherwise record the exact external gate without claiming publication
- [x] 4.4 Sync canonical specs, archive the completed OpenSpec change, and leave `main` clean and synchronized
