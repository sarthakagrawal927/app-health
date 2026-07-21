// Command go-echo-example demonstrates App Health with Echo v4.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/labstack/echo/v4"
	apphealth "github.com/sarthakagrawal927/app-health/packages/go"
	apphealthecho "github.com/sarthakagrawal927/app-health/packages/go/echo"
)

func main() {
	key := os.Getenv("APP_HEALTH_INGEST_KEY")
	if key == "" {
		log.Fatal("set APP_HEALTH_INGEST_KEY")
	}
	client := apphealth.New(apphealth.Config{
		IngestKey: key,
		IngestURL: "https://ingest.sassmaker.com/v1/ingest",
		Release:   os.Getenv("APP_VERSION"),
	})
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := client.Close(ctx); err != nil {
			log.Printf("app health close: %v", err)
		}
	}()

	server := echo.New()
	server.Use(apphealthecho.Middleware(client))
	server.GET("/health", func(context echo.Context) error {
		return context.JSON(http.StatusOK, map[string]bool{"ok": true})
	})
	server.GET("/users/:id", func(context echo.Context) error {
		return context.JSON(http.StatusOK, map[string]string{"id": context.Param("id")})
	})

	log.Fatal(server.Start(":8080"))
}
