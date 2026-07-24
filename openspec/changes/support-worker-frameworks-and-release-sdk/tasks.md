## 1. Runtime contract

- [x] 1.1 Add `worker` to shared and packaged runtime contracts, fixtures, ingest validation, storage interfaces, and tests
- [x] 1.2 Add Worker-specific installation-state and dashboard presentation coverage

## 2. Worker framework adapters

- [x] 2.1 Implement the optional Hono middleware export with lazy client resolution, trusted matched-route capture, error preservation, and `waitUntil` delivery
- [x] 2.2 Implement the Pages Function wrapper with explicit route templates, response/error preservation, optional configuration, and `waitUntil` delivery
- [x] 2.3 Add route, privacy, outage, lifecycle, and no-configuration tests for both adapters

## 3. Package and onboarding

- [x] 3.1 Add Hono and Pages package exports, optional peer metadata, build entries, and version `0.2.0`
- [x] 3.2 Extend external tarball verification to import and exercise every adapter subpath
- [x] 3.3 Add Hono, Pages Functions, and GitHub Release fallback instructions to the package, root, and dashboard onboarding

## 4. Validation and release

- [x] 4.1 Run focused adapter/contract tests, the full TypeScript check, Go test/vet, package verification, and strict OpenSpec validation
- [x] 4.2 Commit and push the synchronized App Health release commit
- [ ] 4.3 Create tag and public GitHub Release `node-v0.2.0` with the exact verified tarball asset after npm authentication is rechecked

## 5. Fleet pilot

- [ ] 5.1 Install the immutable `0.2.0` release asset in Free AI and register Hono middleware behind an optional environment binding
- [ ] 5.2 Run Free AI checks and privacy review, then commit, push, deploy through the existing guard, and smoke the public routes
- [ ] 5.3 Record that live App Health connection remains conditional on separately provisioning the environment-scoped ingest key
