// Package apphealthechov5 provides Echo v5 middleware for App Health.
package apphealthechov5

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v5"
	apphealth "github.com/sarthakagrawal927/app-health/packages/go"
)

// InstallFromEnvironment installs App Health only when the explicit enabled
// flag, required environment, and ingest key all allow it. The returned
// cleanup function flushes pending events and is safe to defer.
func InstallFromEnvironment(e *echo.Echo, requiredEnvironment string) func() {
	client := apphealth.NewFromEnvironment(requiredEnvironment, "")
	if client == nil {
		return func() {}
	}
	e.Use(Middleware(client))
	return func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = client.Close(ctx)
	}
}

// Middleware records one privacy-safe endpoint summary after each Echo v5
// handler. It uses Echo's matched route template and preserves responses,
// returned errors, and panic behavior. Delivery is asynchronous and fail-open.
func Middleware(client *apphealth.Client) echo.MiddlewareFunc {
	if client == nil {
		panic("apphealth/echo/v5: nil client")
	}
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(context *echo.Context) (err error) {
			start := time.Now()
			defer func() {
				if recovered := recover(); recovered != nil {
					client.Record(apphealth.RecordInput{
						Method:     context.Request().Method,
						Route:      context.Path(),
						StatusCode: http.StatusInternalServerError,
						Duration:   time.Since(start),
					})
					panic(recovered)
				}
				client.Record(apphealth.RecordInput{
					Method:     context.Request().Method,
					Route:      context.Path(),
					StatusCode: responseStatus(context, err),
					Duration:   time.Since(start),
				})
			}()
			err = next(context)
			return err
		}
	}
}

func responseStatus(context *echo.Context, err error) int {
	response, unwrapErr := echo.UnwrapResponse(context.Response())
	if unwrapErr == nil && response.Committed && response.Status >= http.StatusContinue {
		return response.Status
	}
	if err != nil {
		var httpError *echo.HTTPError
		if errors.As(err, &httpError) && httpError.Code >= http.StatusContinue && httpError.Code <= 599 {
			return httpError.Code
		}
		return http.StatusInternalServerError
	}
	if unwrapErr == nil && response.Status >= http.StatusContinue {
		return response.Status
	}
	return http.StatusOK
}
