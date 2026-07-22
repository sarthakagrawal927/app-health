//go:build !go1.23

package apphealth

import "net/http"

// Go 1.22 has no Request.Pattern. Middleware resolves a directly wrapped
// ServeMux pattern before dispatch; third-party routers use RouteResolver.
func requestPattern(_ *http.Request) (string, bool) {
	return "", false
}
