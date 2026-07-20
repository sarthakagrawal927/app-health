package apphealth

import (
	"bufio"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

// RouteResolver resolves a normalized route template for a request when the
// framework does not populate Request.Pattern (e.g. third-party routers).
// Return "" to fall back to the conservative normalizer.
type RouteResolver func(*http.Request) string

// Middleware returns net/http middleware that records method, normalized
// route, status code, duration, timestamp, and optional release for each
// completed request, then enqueues the summary for asynchronous delivery.
//
// The middleware preserves handler response behavior (status, headers, body),
// the http.Flusher, http.Hijacker, http.Pusher, and io.ReaderFrom optional
// interfaces when the underlying ResponseWriter supports them, and panic
// behavior: a panicking handler still propagates the panic to the surrounding
// server's recovery (which returns 500 to the client). The middleware records
// status 500 for a panicked handler and re-raises the original panic value.
func (c *Client) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := c.now()
		rw := &responseWriter{ResponseWriter: w}
		defer func() {
			elapsed := c.now().Sub(start)
			if rec := recover(); rec != nil {
				// The surrounding server's recovery returns 500 to the client.
				// Record 500 for the panicked handler, then re-raise so panic
				// behavior (propagation, server recovery, client response) is
				// unchanged by instrumentation.
				rw.status = http.StatusInternalServerError
				rw.wroteHeader = true
				c.record(rw, r, start, elapsed)
				panic(rec)
			}
			rw.finish()
			c.record(rw, r, start, elapsed)
		}()
		next.ServeHTTP(rw, r)
	})
}

// record builds and enqueues a single EventV1. It never reads headers,
// cookies, query, parameters, or bodies.
func (c *Client) record(rw *responseWriter, r *http.Request, start time.Time, elapsed time.Duration) {
	route := c.resolveRoute(r)
	if route == "" {
		// No usable route identity; drop rather than emit a misleading event.
		return
	}
	method := strings.ToUpper(strings.TrimSpace(r.Method))
	if method == "" {
		method = "GET"
	}
	if len(method) > MaxMethodLength {
		method = method[:MaxMethodLength]
	}

	dur := int(elapsed.Milliseconds())
	if dur < 0 {
		dur = 0
	}
	if dur > MaxDurationMs {
		dur = MaxDurationMs
	}

	status := rw.status
	if status < MinStatusCode || status > MaxStatusCode {
		// Unknown or missing status; record as 200 which is the net/http
		// default when WriteHeader is never called.
		status = http.StatusOK
	}

	ev := EventV1{
		EventID:    newEventID(),
		Timestamp:  start.UnixMilli(),
		Method:     method,
		Route:      route,
		StatusCode: status,
		DurationMs: dur,
	}
	if r := c.cfg.Release; r != "" {
		rr := r
		ev.Release = &rr
	}
	c.enqueue(ev)
}

// resolveRoute picks the route identity in priority order:
//  1. configured RouteResolver (if any and returns non-empty)
//  2. Go 1.23+ Request.Pattern (ServeMux), converted to :wildcard form
//  3. conservative numeric/UUID fallback on the concrete path
func (c *Client) resolveRoute(r *http.Request) string {
	if c.cfg.RouteResolver != nil {
		if route := c.cfg.RouteResolver(r); route != "" {
			if len(route) > MaxRouteLength {
				return ""
			}
			return route
		}
	}
	if pattern, ok := requestPattern(r); ok {
		return patternToRoute(pattern)
	}
	return normalizeRouteFallback(r.URL.Path)
}

// responseWriter wraps http.ResponseWriter to capture the final status code
// while preserving optional interfaces. It deliberately does NOT recover
// panics so handler panic semantics are unchanged.
type responseWriter struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (w *responseWriter) WriteHeader(code int) {
	if w.wroteHeader {
		return
	}
	w.status = code
	w.wroteHeader = true
	w.ResponseWriter.WriteHeader(code)
}

func (w *responseWriter) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		w.status = http.StatusOK
		w.wroteHeader = true
	}
	return w.ResponseWriter.Write(b)
}

// finish finalizes the status if the handler never called WriteHeader or Write.
func (w *responseWriter) finish() {
	if !w.wroteHeader {
		w.status = http.StatusOK
		w.wroteHeader = true
	}
}

// Flush proxies http.Flusher when supported.
func (w *responseWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Hijack proxies http.Hijacker when supported. The signature matches
// http.Hijacker so the wrapper satisfies the interface when the underlying
// writer does.
func (w *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if h, ok := w.ResponseWriter.(http.Hijacker); ok {
		return h.Hijack()
	}
	return nil, nil, http.ErrNotSupported
}

// Push proxies http.Pusher when supported.
func (w *responseWriter) Push(target string, opts *http.PushOptions) error {
	if p, ok := w.ResponseWriter.(http.Pusher); ok {
		return p.Push(target, opts)
	}
	return http.ErrNotSupported
}

// ReadFrom proxies io.ReaderFrom when supported so handlers using io.Copy into
// the ResponseWriter keep their zero-copy fast path. The signature matches
// io.ReaderFrom.
func (w *responseWriter) ReadFrom(src io.Reader) (int64, error) {
	if rf, ok := w.ResponseWriter.(io.ReaderFrom); ok {
		return rf.ReadFrom(src)
	}
	return io.Copy(w.ResponseWriter, src)
}
