## 1. Contract and SDKs

- [x] 1.1 Add required batch IDs to shared, Node, and Go contracts and fixtures
- [x] 1.2 Generate retry-stable batch IDs in Node and Go delivery paths

## 2. Worker storage

- [x] 2.1 Replace per-event repository dedupe with per-batch dedupe
- [x] 2.2 Add additive `seen_batches` migration and bounded cleanup capacity

## 3. Verification and release

- [x] 3.1 Add duplicate-batch and storage-cardinality tests
- [x] 3.2 Run TypeScript, Go, migration, and strict OpenSpec checks
- [x] 3.3 Update project status and publish the reviewed change
