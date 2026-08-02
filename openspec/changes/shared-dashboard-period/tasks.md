## 1. Failure query contract

- [x] 1.1 Add the resolved supported window to the failure-query response contract and fixtures.
- [x] 1.2 Parse an optional allowlisted failure window, default it to 24h, and derive the repository lower bound from that window.
- [x] 1.3 Cover supported, defaulted, unsupported, and environment-scoped failure queries.

## 2. Shared dashboard period

- [x] 2.1 Keep one dashboard window state and render the existing accessible selector in both views.
- [x] 2.2 Send the selected window with retained-failure reads and render period-specific retained-data copy.
- [x] 2.3 Cover period selection across Endpoints and Data received, including tab and environment changes.

## 3. Verification

- [x] 3.1 Run focused contract, Worker, and web tests plus typecheck and build.
- [x] 3.2 Run the full repository check and strict OpenSpec validation.
- [ ] 3.3 Verify both live views at 15m, 1h, and 24h after the guarded production release.
