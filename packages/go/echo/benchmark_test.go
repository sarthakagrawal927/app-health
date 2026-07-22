package apphealthecho

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	apphealth "github.com/sarthakagrawal927/app-health/packages/go"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (function roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return function(request)
}

func BenchmarkEchoRequest(b *testing.B) {
	b.Run("baseline", func(b *testing.B) {
		server := benchmarkServer(nil)
		benchmarkRequests(b, server)
	})

	b.Run("app_health", func(b *testing.B) {
		client := benchmarkClient(b)
		server := benchmarkServer(Middleware(client))
		benchmarkRequests(b, server)
	})
}

func BenchmarkEchoRequestParallel(b *testing.B) {
	b.Run("baseline", func(b *testing.B) {
		server := benchmarkServer(nil)
		benchmarkParallelRequests(b, server)
	})

	b.Run("app_health", func(b *testing.B) {
		client := benchmarkClient(b)
		server := benchmarkServer(Middleware(client))
		benchmarkParallelRequests(b, server)
	})
}

func benchmarkServer(middleware echo.MiddlewareFunc) *echo.Echo {
	server := echo.New()
	server.HideBanner = true
	server.HidePort = true
	if middleware != nil {
		server.Use(middleware)
	}
	server.GET("/users/:id", func(context echo.Context) error {
		return context.NoContent(http.StatusNoContent)
	})
	return server
}

func benchmarkRequests(b *testing.B, server *echo.Echo) {
	b.Helper()
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		request := httptest.NewRequest(http.MethodGet, "/users/benchmark-user", nil)
		response := httptest.NewRecorder()
		server.ServeHTTP(response, request)
		if response.Code != http.StatusNoContent {
			b.Fatalf("unexpected response status: %d", response.Code)
		}
	}
}

func benchmarkParallelRequests(b *testing.B, server *echo.Echo) {
	b.Helper()
	b.ReportAllocs()
	b.ResetTimer()
	b.RunParallel(func(parallel *testing.PB) {
		for parallel.Next() {
			request := httptest.NewRequest(http.MethodGet, "/users/benchmark-user", nil)
			response := httptest.NewRecorder()
			server.ServeHTTP(response, request)
			if response.Code != http.StatusNoContent {
				b.Fatalf("unexpected response status: %d", response.Code)
			}
		}
	})
}

func benchmarkClient(b *testing.B) *apphealth.Client {
	b.Helper()
	transport := roundTripFunc(func(request *http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusAccepted,
			Body:       io.NopCloser(strings.NewReader("accepted")),
			Header:     make(http.Header),
			Request:    request,
		}, nil
	})
	client := apphealth.New(apphealth.Config{
		IngestURL:     "http://app-health-benchmark.invalid/v1/ingest",
		IngestKey:     "benchmark-key",
		QueueSize:     65_536,
		BatchSize:     1_000,
		FlushInterval: time.Hour,
		Timeout:       time.Second,
		MaxRetries:    0,
		HTTPClient:    &http.Client{Transport: transport},
	})
	b.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := client.Close(ctx); err != nil {
			b.Errorf("close benchmark client: %v", err)
		}
	})
	return client
}
