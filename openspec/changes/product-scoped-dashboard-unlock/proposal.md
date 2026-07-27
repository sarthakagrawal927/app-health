## Why

The Polaris product ingest key currently unlocks a global owner session, so the
dashboard can default to demo data instead of Polaris. A product key must be the
single credential for both ingest and a dashboard session scoped to that same
product.

## What Changes

- Accept an active product-scoped ingest key as dashboard bearer
  authentication.
- Resolve the key through its existing verifier and scope owner reads to the
  key's app.
- Reject cross-product reads, product creation, and key-management mutations
  from a product-scoped session.
- Retain the dedicated owner bearer secret as a backward-compatible global
  operator credential.
- Reuse the existing Polaris key and stored telemetry without changing Polaris
  code, D1 schema, keys, environments, or endpoint data.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-key-setup`: Product-scoped ingest keys also authenticate a
  product-scoped dashboard session.
- `endpoint-dashboard`: A product-key session lists and queries only the
  product resolved from that key.

## Impact

- Affected code: Worker owner authentication/routing, service app listing,
  dashboard unlock tests, and owner-auth tests.
- Affected APIs: Existing owner endpoints gain product-key authentication and
  product scope; routes and response shapes remain unchanged.
- Dependencies and storage: no new dependency, migration, secret, key, or data
  rewrite.
- Polaris: no code or configuration change; the released product key is reused.
