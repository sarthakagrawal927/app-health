//go:build go1.23

package apphealth

import "net/http"

// requestPattern uses the direct Go 1.23+ Request.Pattern API when available.
func requestPattern(r *http.Request) (string, bool) {
	return r.Pattern, r.Pattern != ""
}
