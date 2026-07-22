package apphealth

import (
	"regexp"
	"testing"
)

var generatedUUIDV4Pattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

func TestNewEventID_IsUniqueRFC4122V4(t *testing.T) {
	seen := make(map[string]struct{}, 1_000)
	for range 1_000 {
		id := newEventID()
		if !generatedUUIDV4Pattern.MatchString(id) {
			t.Fatalf("invalid UUID v4: %q", id)
		}
		if _, exists := seen[id]; exists {
			t.Fatalf("duplicate UUID: %q", id)
		}
		seen[id] = struct{}{}
	}
}
