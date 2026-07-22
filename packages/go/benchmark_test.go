package apphealth

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// BenchmarkMiddlewareOverhead measures the per-request overhead added by the
// Go SDK middleware against a bare handler. The ingest endpoint is a no-op
// recording server so delivery cost is excluded from the request path
// (delivery is asynchronous).
func BenchmarkMiddlewareOverhead(b *testing.B) {
	rs := newRecordingServer()
	srv := httptest.NewServer(rs.handler())
	defer srv.Close()

	c := New(Config{
		IngestURL:     srv.URL,
		IngestKey:     "bench",
		QueueSize:     1024,
		BatchSize:     100,
		FlushInterval: 50 * time.Millisecond,
		Timeout:       time.Second,
		MaxRetries:    0,
		BaseBackoff:   time.Millisecond,
	})
	defer func() {
		ctx, cancel := contextWithTimeout(2 * time.Second)
		defer cancel()
		_ = c.Close(ctx)
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /bench/{id}", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
	h := c.Middleware(mux)

	b.ResetTimer()
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("GET", "/bench/123", nil)
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != 200 {
			b.Fatalf("status %d", rr.Code)
		}
	}
	b.StopTimer()
}

// BenchmarkBareHandler is the baseline without middleware.
func BenchmarkBareHandler(b *testing.B) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /bench/{id}", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte("ok"))
	})
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("GET", "/bench/123", nil)
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		if rr.Code != 200 {
			b.Fatalf("status %d", rr.Code)
		}
	}
}

// BenchmarkNormalizeRouteTemplate measures trusted-template normalization.
func BenchmarkNormalizeRouteTemplate(b *testing.B) {
	path := "/u/550e8400-e29b-41d4-a716-446655440000/posts/123/comments/456"
	b.ReportAllocs()
	for i := 0; i < b.N; i++ {
		_ = normalizeRouteTemplate(path)
	}
}

// Ensure the unused import does not cause a compile error if benchmarks are
// not run; io is used by handlers above.
var _ = io.Discard
