package apphealthechov5

import (
	"testing"

	"github.com/labstack/echo/v5"
)

func TestInstallFromEnvironmentDisabledIsNoop(t *testing.T) {
	t.Setenv("APP_HEALTH_ENABLED", "false")
	t.Setenv("APP_ENV", "staging")
	t.Setenv("APP_HEALTH_INGEST_KEY", "test-key")

	e := echo.New()
	cleanup := InstallFromEnvironment(e, "staging")
	cleanup()
}
