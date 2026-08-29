# App Health

App Health gives developers and service operators a private, privacy-first view of endpoint health from observed traffic.

## What it replaces

Instead of opening separate error, analytics, messaging, and cloud consoles to understand basic service health, one App Health view shows route traffic, latency, errors, and freshness across short time windows.

## How it works

- Add the fail-open Node, Hono, Cloudflare Pages, Go, or Echo SDK, or connect an existing OpenTelemetry Collector.
- Send normalized method-and-route observations to an authenticated ingest endpoint.
- Inspect aggregate endpoint summaries for 15-minute, 1-hour, 24-hour, and 7-day windows in the private owner dashboard.

## Current proof

- The production V0 supports Node, Worker, Go, and OTLP ingestion.
- Product-scoped keys separate environments while the owner dashboard remains authenticated.
- The production dashboard and ingest service are live, and the corrected Node and Go canaries returned all five observed routes after the aggregate-ingest migration.

## Public boundary

- Aggregate endpoint latency, status, and availability summaries
- No request bodies, headers, cookies, query values, identities, logs, or stack traces
- Owner APIs remain authenticated and are not agent-indexed

## Access and next action

New evaluators should start with the install guide and verified release history. Existing operators can open the hosted dashboard with the owner key for their Cloudflare deployment; there is no public signup or pricing claim.

- Install guide: https://github.com/sass-maker/app-health#install-the-sdks
- Source: https://github.com/sass-maker/app-health
- Changelog: https://health.sassmaker.com/changelog

## Agent entrypoints

- https://health.sassmaker.com/llms.txt
- https://health.sassmaker.com/api/ai
- https://health.sassmaker.com/index.md
