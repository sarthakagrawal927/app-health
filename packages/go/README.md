# App Health for Go

The Go 1.22+ SDK records privacy-safe endpoint summaries through a bounded,
asynchronous, fail-open client. It supports `net/http` directly and Echo v5
through a dedicated adapter.

```bash
go get github.com/sarthakagrawal927/app-health/packages/go/echo/v5@v5.1.0
```

## Echo

```go
import (
	"os"

	"github.com/labstack/echo/v5"
	apphealthechov5 "github.com/sarthakagrawal927/app-health/packages/go/echo/v5"
)

e := echo.New()
cleanup := apphealthechov5.Install(e, apphealthechov5.Config{
	Enabled:     true,
	Environment: "staging",
	Key:         os.Getenv("APP_HEALTH_INGEST_KEY"),
	Project:     "orders-api",
})
defer cleanup()
```

The adapter uses `echo.Context.Path()` after routing, so `/users/alice` and
`/users/bob` are both recorded as `/users/:id`. It preserves committed
responses, returned `echo.HTTPError` values, and panics.

The installer owns the ingest endpoint, queue, batching, retries, privacy
filtering, and bounded shutdown. It is a no-op when `Enabled` is false or `Key`
is empty. The SDK never reads headers, query values, route parameters, bodies,
cookies, or identity. It never sends unmatched concrete paths: if no trusted
route template is available, that event is dropped. Release tags accept only
letters, digits, `.`, `_`, `+`, and `-`; unsafe free-form strings are omitted.

Request handling only creates and enqueues the normalized summary. A background
goroutine flushes bounded batches (100 events or every 5 seconds by default),
with bounded retry/timeout behavior. The checked-in serial and parallel Echo
benchmarks keep the incremental request-boundary work well below the 2 ms p95
budget on the documented development hardware.
