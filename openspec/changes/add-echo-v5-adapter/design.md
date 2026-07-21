## Technical design

Add package path `github.com/sarthakagrawal927/app-health/packages/go/echo/v5`
using Echo v5's `*echo.Context`. The adapter records `Context.Path()`, request
method, final response status, duration, and the core client's configured
release through the existing non-blocking `Record` API.

The adapter must not recover panics or alter returned errors. If Echo has not
matched a route, `Context.Path()` is empty and the core client drops the event;
the concrete request URL is never used. Status resolution mirrors the Echo v4
adapter, using `echo.UnwrapResponse` and `echo.HTTPError`.

The adapter remains thin but exposes `InstallFromEnvironment`, which attaches
middleware and returns a safe cleanup function. Construction requires an
explicit enabled flag, project name, matching environment, and ingest key.
Project and environment are explicit SDK identity inputs. The ingest key remains
authoritative for server-side app/environment attribution, so the strict event
payload does not duplicate or trust caller-provided identity.
