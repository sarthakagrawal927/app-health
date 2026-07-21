package apphealthecho

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	apphealth "github.com/sarthakagrawal927/app-health/packages/go"
)

type ingestRecorder struct {
	mu     sync.Mutex
	bodies [][]byte
	status int
}

func newClient(t *testing.T, status int) (*apphealth.Client, *ingestRecorder) {
	t.Helper()
	recorder := &ingestRecorder{status: status}
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		body, _ := io.ReadAll(request.Body)
		recorder.mu.Lock()
		recorder.bodies = append(recorder.bodies, body)
		recorder.mu.Unlock()
		writer.WriteHeader(recorder.status)
	}))
	t.Cleanup(server.Close)
	client := apphealth.New(apphealth.Config{
		IngestURL:     server.URL,
		IngestKey:     "test-key",
		BatchSize:     100,
		FlushInterval: time.Hour,
		Timeout:       time.Second,
		MaxRetries:    0,
	})
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = client.Close(ctx)
	})
	return client, recorder
}

func flush(t *testing.T, client *apphealth.Client) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := client.Flush(ctx); err != nil {
		t.Fatalf("flush: %v", err)
	}
}

func (recorder *ingestRecorder) events(t *testing.T) []apphealth.EventV1 {
	t.Helper()
	recorder.mu.Lock()
	defer recorder.mu.Unlock()
	var events []apphealth.EventV1
	for _, body := range recorder.bodies {
		var batch apphealth.EventBatchV1
		if err := json.Unmarshal(body, &batch); err != nil {
			t.Fatalf("decode batch: %v", err)
		}
		events = append(events, batch.Events...)
	}
	return events
}

func TestMiddleware_UsesEchoRouteTemplate(t *testing.T) {
	client, recorder := newClient(t, http.StatusAccepted)
	server := echo.New()
	server.Use(Middleware(client))
	server.GET("/users/:id", func(context echo.Context) error {
		return context.NoContent(http.StatusNoContent)
	})

	for _, path := range []string{"/users/alice", "/users/bob"} {
		request := httptest.NewRequest(http.MethodGet, path, nil)
		response := httptest.NewRecorder()
		server.ServeHTTP(response, request)
		if response.Code != http.StatusNoContent {
			t.Fatalf("unexpected response for %s: %d", path, response.Code)
		}
	}
	flush(t, client)
	events := recorder.events(t)
	if len(events) != 2 {
		t.Fatalf("expected two events, got %d", len(events))
	}
	for _, event := range events {
		if event.Route != "/users/:id" || event.StatusCode != http.StatusNoContent {
			t.Fatalf("unexpected event: %+v", event)
		}
	}
}

func TestMiddleware_PreservesReturnedHTTPError(t *testing.T) {
	client, recorder := newClient(t, http.StatusAccepted)
	server := echo.New()
	want := echo.NewHTTPError(http.StatusUnprocessableEntity, "invalid")
	handler := Middleware(client)(func(context echo.Context) error { return want })
	request := httptest.NewRequest(http.MethodPost, "/orders/123", nil)
	response := httptest.NewRecorder()
	context := server.NewContext(request, response)
	context.SetPath("/orders/:id")

	if got := handler(context); got != want {
		t.Fatalf("middleware changed returned error: got %v want %v", got, want)
	}
	flush(t, client)
	events := recorder.events(t)
	if len(events) != 1 || events[0].StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("expected recorded 422, got %+v", events)
	}
}

func TestMiddleware_PreservesCommittedResponse(t *testing.T) {
	client, recorder := newClient(t, http.StatusAccepted)
	server := echo.New()
	server.Use(Middleware(client))
	server.GET("/teapot", func(context echo.Context) error {
		return context.String(http.StatusTeapot, "still a teapot")
	})
	request := httptest.NewRequest(http.MethodGet, "/teapot", nil)
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code != http.StatusTeapot || response.Body.String() != "still a teapot" {
		t.Fatalf("response changed: %d %q", response.Code, response.Body.String())
	}
	flush(t, client)
	events := recorder.events(t)
	if len(events) != 1 || events[0].StatusCode != http.StatusTeapot {
		t.Fatalf("expected recorded 418, got %+v", events)
	}
}

func TestMiddleware_PreservesPanic(t *testing.T) {
	client, recorder := newClient(t, http.StatusAccepted)
	server := echo.New()
	handler := Middleware(client)(func(context echo.Context) error { panic("boom") })
	request := httptest.NewRequest(http.MethodGet, "/panic", nil)
	response := httptest.NewRecorder()
	context := server.NewContext(request, response)
	context.SetPath("/panic")

	func() {
		defer func() {
			if recovered := recover(); recovered != "boom" {
				t.Fatalf("panic changed: %v", recovered)
			}
		}()
		_ = handler(context)
	}()
	flush(t, client)
	events := recorder.events(t)
	if len(events) != 1 || events[0].StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected recorded 500, got %+v", events)
	}
}

func TestMiddleware_DoesNotCaptureRequestContent(t *testing.T) {
	client, recorder := newClient(t, http.StatusAccepted)
	server := echo.New()
	server.Use(Middleware(client))
	server.POST("/accounts/:id", func(context echo.Context) error {
		return context.NoContent(http.StatusCreated)
	})
	request := httptest.NewRequest(
		http.MethodPost,
		"/accounts/concrete-secret?token=query-secret",
		strings.NewReader("body-secret"),
	)
	request.Header.Set("Authorization", "Bearer header-secret")
	request.AddCookie(&http.Cookie{Name: "session", Value: "cookie-secret"})
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	flush(t, client)

	recorder.mu.Lock()
	serialized := string(strings.Join(bytesToStrings(recorder.bodies), ""))
	recorder.mu.Unlock()
	for _, secret := range []string{"concrete-secret", "query-secret", "body-secret", "header-secret", "cookie-secret"} {
		if strings.Contains(serialized, secret) {
			t.Fatalf("captured secret %q in %s", secret, serialized)
		}
	}
	if !strings.Contains(serialized, "/accounts/:id") {
		t.Fatalf("missing route template in %s", serialized)
	}
}

func TestMiddleware_IngestOutageDoesNotChangeResponse(t *testing.T) {
	client, _ := newClient(t, http.StatusInternalServerError)
	server := echo.New()
	server.Use(Middleware(client))
	server.GET("/health", func(context echo.Context) error {
		return context.JSON(http.StatusOK, map[string]bool{"ok": true})
	})
	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	response := httptest.NewRecorder()
	server.ServeHTTP(response, request)
	if response.Code != http.StatusOK || !strings.Contains(response.Body.String(), `"ok":true`) {
		t.Fatalf("outage changed response: %d %q", response.Code, response.Body.String())
	}
	flush(t, client)
	if client.Stats().Failed != 1 {
		t.Fatalf("expected one failed event, got %+v", client.Stats())
	}
}

func bytesToStrings(values [][]byte) []string {
	stringsOut := make([]string, len(values))
	for index, value := range values {
		stringsOut[index] = string(value)
	}
	return stringsOut
}
