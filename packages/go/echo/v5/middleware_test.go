package apphealthechov5

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v5"
	apphealth "github.com/sarthakagrawal927/app-health/packages/go"
)

func TestMiddlewareRecordsTemplateAndPreservesValuePrivacy(t *testing.T) {
	var bodies [][]byte
	ingest := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		bodies = append(bodies, body)
		w.WriteHeader(http.StatusAccepted)
	}))
	t.Cleanup(ingest.Close)
	client := apphealth.New(apphealth.Config{IngestURL: ingest.URL, IngestKey: "test-key", FlushInterval: time.Hour, MaxRetries: 0})
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = client.Close(ctx)
	})

	e := echo.New()
	e.Use(Middleware(client))
	e.GET("/accounts/:id", func(c *echo.Context) error { return c.NoContent(http.StatusNoContent) })
	request := httptest.NewRequest(http.MethodGet, "/accounts/customer-private", nil)
	response := httptest.NewRecorder()
	e.ServeHTTP(response, request)
	if response.Code != http.StatusNoContent {
		t.Fatalf("unexpected response status: %d", response.Code)
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := client.Flush(ctx); err != nil {
		t.Fatalf("flush: %v", err)
	}
	if len(bodies) != 1 {
		t.Fatalf("expected one batch, got %d", len(bodies))
	}
	var batch apphealth.EventBatchV1
	if err := json.Unmarshal(bodies[0], &batch); err != nil {
		t.Fatalf("decode batch: %v", err)
	}
	if len(batch.Events) != 1 || batch.Events[0].Route != "/accounts/:id" {
		t.Fatalf("unexpected events: %+v", batch.Events)
	}
	if strings.Contains(string(bodies[0]), "customer-private") {
		t.Fatalf("concrete route value leaked: %s", bodies[0])
	}
}

func TestMiddlewareDropsUnmatchedConcretePath(t *testing.T) {
	var body string
	ingest := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		contents, _ := io.ReadAll(r.Body)
		body = string(contents)
		w.WriteHeader(http.StatusAccepted)
	}))
	t.Cleanup(ingest.Close)
	client := apphealth.New(apphealth.Config{IngestURL: ingest.URL, IngestKey: "test-key", MaxRetries: 0})
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = client.Close(ctx)
	})
	e := echo.New()
	e.Use(Middleware(client))
	request := httptest.NewRequest(http.MethodGet, "/private-customer-slug", nil)
	response := httptest.NewRecorder()
	e.ServeHTTP(response, request)
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	if err := client.Flush(ctx); err != nil {
		t.Fatalf("flush: %v", err)
	}
	if strings.Contains(body, "private-customer-slug") || strings.Contains(body, "events") {
		t.Fatalf("unmatched path produced telemetry: %s", body)
	}
}
