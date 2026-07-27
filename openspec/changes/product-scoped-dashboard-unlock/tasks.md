## 1. Product-scoped authentication

- [x] 1.1 Extend owner identity with optional app scope and resolve active product keys through the existing key repository.
- [x] 1.2 Filter app discovery to the resolved product and reject cross-product installation, endpoint, and failure reads.
- [x] 1.3 Keep product creation and key revocation global-owner-only.

## 2. Verification

- [x] 2.1 Add focused tests for Polaris-only listing, cross-product rejection, legacy/revoked key rejection, and mutation denial.
- [x] 2.2 Run focused Worker tests, full TypeScript checks, Go tests/vet, and strict OpenSpec validation.
- [x] 2.3 Confirm the diff changes no Polaris files, key rows, environment rows, or telemetry data.

## 3. Release

- [ ] 3.1 Merge the App Health-only change after CI passes and deploy the Worker from clean, synced main with the exact SHA tag.
- [ ] 3.2 Verify the existing Polaris key returns only Polaris with Local/Staging data and rejects another app id.
