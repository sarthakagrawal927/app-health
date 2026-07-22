package apphealth

import (
	"regexp"
	"strings"
)

// numericSegment matches a path segment that is entirely decimal digits.
var numericSegment = regexp.MustCompile(`^[0-9]+$`)

// uuidSegment matches an RFC 4122 shaped UUID (any version/variant) segment.
var uuidSegment = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// normalizeRouteTemplate validates a trusted framework route template and
// replaces purely numeric path segments with ":id" and UUID-shaped segments
// with ":uuid" as defense in depth. Official adapters never call this with an
// unmatched concrete request path.
//
// Routes longer than MaxRouteLength are dropped to avoid merging distinct
// endpoints into the same truncated identity.
func normalizeRouteTemplate(path string) string {
	if path == "" || path != strings.TrimSpace(path) || !strings.HasPrefix(path, "/") || strings.ContainsAny(path, "?#") {
		return ""
	}
	segments := strings.Split(path, "/")
	for i, seg := range segments {
		if seg == "" {
			continue
		}
		switch {
		case uuidSegment.MatchString(seg):
			segments[i] = ":uuid"
		case numericSegment.MatchString(seg):
			segments[i] = ":id"
		}
	}
	out := strings.Join(segments, "/")
	if len(out) > MaxRouteLength {
		return ""
	}
	return out
}

// normalizeRelease accepts only bounded machine-safe release identifiers.
// Unsafe free-form strings are omitted instead of partially redacted.
func normalizeRelease(release string) string {
	if release == "" || release != strings.TrimSpace(release) || len(release) > MaxReleaseLength {
		return ""
	}
	for index := 0; index < len(release); index++ {
		character := release[index]
		if (character >= 'a' && character <= 'z') ||
			(character >= 'A' && character <= 'Z') ||
			(character >= '0' && character <= '9') ||
			character == '.' || character == '_' || character == '+' || character == '-' {
			continue
		}
		return ""
	}
	return release
}

// patternToRoute converts a Go 1.22 ServeMux request pattern into the V1 route
// template form. ServeMux patterns look like "GET /users/{id}" or
// "/users/{id}" (method omitted) and may include a host prefix. Wildcards
// "{name}" are rewritten to ":name" to match the V1 contract fixture form.
//
// The path portion is returned; method and host are dropped because method is
// captured separately and host is not part of the V1 route identity.
func patternToRoute(pattern string) string {
	if pattern == "" {
		return ""
	}
	rest := pattern
	// Drop a leading "METHOD " token if present (e.g. "GET /users/{id}").
	if i := strings.IndexByte(rest, ' '); i >= 0 {
		first := rest[:i]
		if isHTTPMethod(first) {
			rest = rest[i+1:]
		}
	}
	// Drop a host prefix: Go 1.22 allows "host/path". If the segment before
	// the first "/" contains a "." or no "/", treat everything from the first
	// "/" onward as the path. Otherwise keep the whole string.
	if slash := strings.IndexByte(rest, '/'); slash > 0 {
		hostPart := rest[:slash]
		if strings.Contains(hostPart, ".") {
			rest = rest[slash:]
		}
	}
	// Convert {wildcard} and {wildcard...} to :wildcard.
	var b strings.Builder
	b.Grow(len(rest))
	i := 0
	for i < len(rest) {
		if rest[i] == '{' {
			j := strings.IndexByte(rest[i:], '}')
			if j < 0 {
				b.WriteString(rest[i:])
				break
			}
			name := rest[i+1 : i+j]
			// Strip trailing "..." used for catch-all wildcards.
			name = strings.TrimSuffix(name, "...")
			if name == "" {
				name = "wildcard"
			}
			b.WriteByte(':')
			b.WriteString(name)
			i += j + 1
		} else {
			b.WriteByte(rest[i])
			i++
		}
	}
	return normalizeRouteTemplate(b.String())
}

func isHTTPMethod(s string) bool {
	if len(s) == 0 || len(s) > MaxMethodLength {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c < 'A' || c > 'Z' {
			return false
		}
	}
	return true
}
