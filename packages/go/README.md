# App Health for Go

The Go 1.22+ SDK records privacy-safe endpoint summaries through a bounded,
asynchronous, fail-open client. It supports `net/http` directly and Echo v4
through a dedicated adapter.

The repository is private. Configure the module as private and ensure GitHub
authentication works on the machine before installing:

```bash
go env -w GOPRIVATE=github.com/sarthakagrawal927/app-health
go get github.com/sarthakagrawal927/app-health/packages/go@v0.1.0
```

## Echo

```go
import (
	"context"
	"time"

	"github.com/labstack/echo/v4"
	apphealth "github.com/sarthakagrawal927/app-health/packages/go"
	apphealthecho "github.com/sarthakagrawal927/app-health/packages/go/echo"
)

client := apphealth.New(apphealth.Config{
	IngestKey: os.Getenv("APP_HEALTH_INGEST_KEY"),
	IngestURL: "https://ingest.sassmaker.com/v1/ingest",
	Release:   os.Getenv("APP_VERSION"),
})

e := echo.New()
e.Use(apphealthecho.Middleware(client))

defer func() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = client.Close(ctx)
}()
```

The adapter uses `echo.Context.Path()` after routing, so `/users/alice` and
`/users/bob` are both recorded as `/users/:id`. It preserves committed
responses, returned `echo.HTTPError` values, and panics.

Use `client.Stats()` for local queued, sent, failed, retry, and drop counters.
The SDK never reads headers, query values, route parameters, bodies, cookies,
or identity. Echo v5 applications use the separate module
`github.com/sarthakagrawal927/app-health/packages/go/echo/v5`; unmatched
concrete paths are dropped rather than sent.
