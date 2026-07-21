package apphealth

import (
	"context"
	"testing"
)

func TestNewFromEnvironmentIsGated(t *testing.T) {
	t.Setenv("APP_HEALTH_INGEST_KEY", "test-key")
	t.Setenv("APP_HEALTH_ENABLED", "false")
	t.Setenv("APP_ENV", "staging")
	if client := NewFromEnvironment("staging", "http://localhost:1"); client != nil {
		t.Fatal("expected explicit disabled flag to win")
	}
	t.Setenv("APP_HEALTH_ENABLED", "true")
	t.Setenv("APP_ENV", "production")
	if client := NewFromEnvironment("staging", "http://localhost:1"); client != nil {
		t.Fatal("expected production to remain disabled")
	}
	t.Setenv("APP_ENV", "staging")
	client := NewFromEnvironment("staging", "http://localhost:1")
	if client == nil {
		t.Fatal("expected staging client")
	}
	_ = client.Close(context.Background())
}
