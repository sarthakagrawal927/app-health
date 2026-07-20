//go:build !go1.23

package apphealth

import "net/http"

// Go 1.22 has no Request.Pattern; resolver and conservative fallback remain.
func requestPattern(_ *http.Request) (string, bool) {
	return "", false
}
