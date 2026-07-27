## Context

Production owner APIs currently authenticate one global bearer secret. The
Polaris product key was temporarily assigned the same secret value, which made
unlock succeed but still created a global session whose app list could default
to demo data. Product keys already have a non-reversible verifier and app scope
in D1, so the Worker can derive the correct dashboard scope without changing
stored data.

## Goals / Non-Goals

**Goals:**

- Let an active product-scoped ingest key unlock the dashboard for its own app.
- Enforce the resolved app scope on every owner read.
- Reuse the existing Polaris key, environments, and telemetry unchanged.
- Preserve global owner-secret administration for compatibility.

**Non-Goals:**

- Changing Polaris code, the product key, or any D1 row.
- Letting environment-scoped legacy keys unlock the dashboard.
- Letting a product-scoped session create apps, revoke keys, or access another
  app.
- Changing API routes or response schemas.

## Decisions

1. **Resolve product scope from the existing key repository.** After global
   owner-secret authentication fails, the Worker extracts the same bearer value
   and calls `keys.verifyKey`. It accepts the result only when
   `environment_id` is null, which distinguishes active product keys from
   legacy environment keys. This avoids a second key store or raw-key
   persistence.

2. **Carry optional app scope in owner identity.** Global and local owner
   identities remain unscoped. Product-key identity includes `app_id`, allowing
   one route guard to enforce product isolation before service calls.

3. **Filter app discovery and guard all app/environment reads.** `/v1/apps`
   returns only the resolved app for a scoped identity. Installation, endpoint,
   and failure routes reject mismatched `app_id` before storage or Analytics
   Engine queries.

4. **Keep mutations global-only.** Product creation and key revocation remain
   available only to the unscoped global owner. A product session is an
   operational dashboard session, not a control-plane administrator.

5. **Deploy code only.** No migration or data operation is required. The
   existing Polaris product key and its Local/Staging rows remain the proof
   fixtures for live verification.

## Risks / Trade-offs

- **A route could omit the scope guard** → centralize the check and cover every
  owner route with cross-product tests.
- **A legacy environment key could gain dashboard access** → require a verified
  key record with null `environment_id`.
- **A product session could accidentally retain mutations** → explicitly return
  403 for create and revoke routes when `app_id` scope is present.
- **Global administration could regress** → retain existing owner-secret tests
  and full workspace validation.

## Migration Plan

1. Deploy the Worker code with no D1 migration.
2. Verify the existing Polaris bearer returns one app named `polaris` with its
   existing Local/Staging environments.
3. Verify cross-product queries and mutations return 403.
4. Roll back to the prior Worker version if authentication or dashboard reads
   regress; no data rollback is necessary.

## Open Questions

None. The user explicitly requires one Polaris credential for ingest and its
product-scoped dashboard.
