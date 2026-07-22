package apphealthechov5

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v5"
	apphealth "github.com/sarthakagrawal927/app-health/packages/go"
)

func TestInstallDisabledIsNoop(t *testing.T) {
	e := echo.New()
	cleanup := Install(e, Config{Enabled: false, Environment: "staging", Key: "test-key", Project: "polaris"})
	cleanup()
}

func TestInstallWithoutKeyIsNoop(t *testing.T) {
	e := echo.New()
	cleanup := Install(e, Config{Enabled: true, Environment: "staging", Project: "polaris"})
	cleanup()
}

func TestInstallUsesExplicitConfigAndSDKDefaults(t *testing.T) {
	var authorization string
	var body []byte
	ingest := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization = r.Header.Get("Authorization")
		body, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusAccepted)
	}))
	t.Cleanup(ingest.Close)

	previousIngestURL := ingestURL
	ingestURL = ingest.URL
	t.Cleanup(func() { ingestURL = previousIngestURL })

	e := echo.New()
	cleanup := Install(e, Config{
		Enabled:     true,
		Environment: "staging",
		Key:         " test-key ",
		Project:     "polaris",
	})
	e.GET("/accounts/:id", func(c *echo.Context) error { return c.NoContent(http.StatusNoContent) })

	request := httptest.NewRequest(http.MethodGet, "/accounts/private-value", nil)
	response := httptest.NewRecorder()
	e.ServeHTTP(response, request)
	cleanup()

	if response.Code != http.StatusNoContent {
		t.Fatalf("unexpected response status: %d", response.Code)
	}
	if authorization != "Bearer test-key" {
		t.Fatalf("unexpected authorization header: %q", authorization)
	}
	var batch apphealth.EventBatchV1
	if err := json.Unmarshal(body, &batch); err != nil {
		t.Fatalf("decode batch: %v", err)
	}
	if len(batch.Events) != 1 || batch.Events[0].Route != "/accounts/:id" {
		t.Fatalf("unexpected events: %+v", batch.Events)
	}
	if strings.Contains(string(body), "private-value") {
		t.Fatalf("concrete route value leaked: %s", body)
	}
}
