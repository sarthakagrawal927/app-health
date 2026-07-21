// Canonical Go fixture for the V1 contract. The endpoint summaries are
// equivalent to packages/contracts/src/fixtures.ts so ingest validates both
// runtimes into the same internal event shape. Event IDs are unique per
// fixture because they represent distinct observed requests.
package apphealth

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
)

// CanonicalEndpointSummaries mirrors the TypeScript CANONICAL_ENDPOINT_SUMMARIES.
var CanonicalEndpointSummaries = []struct {
	Method     string
	Route      string
	StatusCode int
	DurationMs int
}{
	{"GET", "/health", 200, 12},
	{"GET", "/users/:id", 200, 45},
	{"GET", "/users/:id", 404, 38},
	{"POST", "/orders", 201, 120},
	{"POST", "/orders", 500, 350},
	{"GET", "/orders/:id", 200, 88},
}

const fixtureNow int64 = 1_725_000_000_000

// deterministicUUID derives an RFC 4122 v4 UUID from a seed so fixtures are stable.
func deterministicUUID(seed uint32) string {
	h := sha256.New()
	var buf [4]byte
	binary.BigEndian.PutUint32(buf[:], seed)
	h.Write(buf[:])
	sum := h.Sum(nil)
	hexStr := hex.EncodeToString(sum[:16])
	// Force version 4 and variant bits.
	hexStr = hexStr[:8] + "-" + hexStr[8:12] + "-4" + hexStr[13:16] + "-a" + hexStr[17:20] + "-" + hexStr[20:32]
	return hexStr
}

// BuildCanonicalBatch builds a v1 batch from the canonical summaries tagged
// with the given runtime. seedBase distinguishes Node and Go fixtures so
// event IDs are unique while endpoint summaries remain equivalent.
func BuildCanonicalBatch(runtime Runtime, release string, seedBase uint32) EventBatchV1 {
	events := make([]EventV1, len(CanonicalEndpointSummaries))
	for i, s := range CanonicalEndpointSummaries {
		r := release
		events[i] = EventV1{
			EventID:    deterministicUUID(seedBase + uint32(i*10)),
			Timestamp:  fixtureNow + int64(i*1000),
			Method:     s.Method,
			Route:      s.Route,
			StatusCode: s.StatusCode,
			DurationMs: s.DurationMs,
			Release:    &r,
		}
	}
	return EventBatchV1{
		BatchID:       deterministicUUID(seedBase - 1),
		SchemaVersion: SchemaVersion,
		Runtime:       runtime,
		Release:       &release,
		Events:        events,
	}
}

// NodeBatchFixture returns the canonical Node fixture built from Go so the Go
// test suite can prove endpoint equivalence with the TypeScript fixture.
func NodeBatchFixture() EventBatchV1 {
	r := "0.0.0-fixture"
	return BuildCanonicalBatch(RuntimeNode, r, 1000)
}

// GoBatchFixture returns the canonical Go fixture.
func GoBatchFixture() EventBatchV1 {
	r := "0.0.0-fixture"
	return BuildCanonicalBatch(RuntimeGo, r, 2000)
}

// EndpointKey is the normalized (method, route, status, duration) tuple used
// for fixture equivalence checks.
type EndpointKey struct {
	Method     string
	Route      string
	StatusCode int
	DurationMs int
}

// EndpointKeys returns the sorted normalized endpoint-summary keys for a batch.
func EndpointKeys(b EventBatchV1) []EndpointKey {
	keys := make([]EndpointKey, len(b.Events))
	for i, e := range b.Events {
		keys[i] = EndpointKey{e.Method, e.Route, e.StatusCode, e.DurationMs}
	}
	// Stable sort by (method, route, status, duration).
	for i := 1; i < len(keys); i++ {
		for j := i; j > 0; j-- {
			a, b := keys[j-1], keys[j]
			if a.Method < b.Method ||
				(a.Method == b.Method && a.Route < b.Route) ||
				(a.Method == b.Method && a.Route == b.Route && a.StatusCode < b.StatusCode) ||
				(a.Method == b.Method && a.Route == b.Route && a.StatusCode == b.StatusCode && a.DurationMs < b.DurationMs) {
				keys[j-1], keys[j] = keys[j], keys[j-1]
			} else {
				break
			}
		}
	}
	return keys
}

// AreEndpointEquivalent returns true if two batches carry equivalent endpoint
// summaries (method, route, status, duration), ignoring event IDs and timestamps.
func AreEndpointEquivalent(a, b EventBatchV1) bool {
	ka, kb := EndpointKeys(a), EndpointKeys(b)
	if len(ka) != len(kb) {
		return false
	}
	for i := range ka {
		if ka[i] != kb[i] {
			return false
		}
	}
	return true
}

// String returns a debug string for an EndpointKey.
func (k EndpointKey) String() string {
	return fmt.Sprintf("%s %s %d %dms", k.Method, k.Route, k.StatusCode, k.DurationMs)
}
