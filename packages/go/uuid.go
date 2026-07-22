package apphealth

import (
	"crypto/rand"
	"fmt"
)

const lowercaseHex = "0123456789abcdef"

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
	var encoded [36]byte
	encoded[8] = '-'
	encoded[13] = '-'
	encoded[18] = '-'
	encoded[23] = '-'
	output := 0
	for _, value := range b {
		if output == 8 || output == 13 || output == 18 || output == 23 {
			output++
		}
		encoded[output] = lowercaseHex[value>>4]
		encoded[output+1] = lowercaseHex[value&0x0f]
		output += 2
	}
	return string(encoded[:])
}
