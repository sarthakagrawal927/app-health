package apphealth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

// newEventID returns a random RFC 4122 v4 UUID string. It panics only if the
// system CSPRNG is unavailable, which is a fatal environment error rather than
// a telemetry error. Standard library only.
func newEventID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(fmt.Sprintf("apphealth: crypto/rand unavailable: %v", err))
	}
	// Version 4, variant RFC 4122.
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%s-%s-%s-%s-%s",
		hex.EncodeToString(b[0:4]),
		hex.EncodeToString(b[4:6]),
		hex.EncodeToString(b[6:8]),
		hex.EncodeToString(b[8:10]),
		hex.EncodeToString(b[10:16]),
	)
}
