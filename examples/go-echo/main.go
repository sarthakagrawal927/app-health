// Command go-echo-example demonstrates App Health with Echo v4.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
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
	ingestURL := os.Getenv("APP_HEALTH_INGEST_URL")
	if ingestURL == "" {
		ingestURL = "https://ingest.sassmaker.com/v1/ingest"
	}
	address := os.Getenv("APP_ADDR")
	if address == "" {
		address = ":8080"
	}
	client := apphealth.New(apphealth.Config{
		IngestKey: key,
		IngestURL: ingestURL,
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

	serverErrors := make(chan error, 1)
	go func() {
		if err := server.Start(address); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrors <- err
		}
	}()

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)
	select {
	case signalReceived := <-shutdown:
		log.Printf("received %s; shutting down", signalReceived)
	case err := <-serverErrors:
		log.Printf("server: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("server shutdown: %v", err)
	}
}
