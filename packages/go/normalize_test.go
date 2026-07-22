package apphealth

import "testing"

func TestNormalizeRelease(t *testing.T) {
	tests := map[string]string{
		"v1.2.3":               "v1.2.3",
		"sha-abc123+prod":      "sha-abc123+prod",
		"alice@example.com":    "",
		"release/private-user": "",
		"v1.2.3?token=secret":  "",
		"release 1":            "",
		" v1.2.3 ":             "",
		"":                     "",
	}
	for input, want := range tests {
		if got := normalizeRelease(input); got != want {
			t.Fatalf("normalizeRelease(%q) = %q; want %q", input, got, want)
		}
	}
}

func TestNormalizeRouteTemplate(t *testing.T) {
	tests := map[string]string{
		"/users/:id": "/users/:id",
		"/users/42":  "/users/:id",
		"/users/550e8400-e29b-41d4-a716-446655440000": "/users/:uuid",
		"/users/:id?token=secret":                     "",
		"users/:id":                                   "",
		"":                                            "",
	}
	for input, want := range tests {
		if got := normalizeRouteTemplate(input); got != want {
			t.Fatalf("normalizeRouteTemplate(%q) = %q; want %q", input, got, want)
		}
	}
}
