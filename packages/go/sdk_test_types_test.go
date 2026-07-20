package apphealth

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"sync"
)

// jsonStrictUnmarshal decodes body into v using a decoder that rejects unknown
// fields and trailing data, mirroring the TypeScript zod .strict() shape.
func jsonStrictUnmarshal(body []byte, v interface{}) error {
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return err
	}
	if dec.More() {
		return errors.New("unexpected trailing JSON input")
	}
	return nil
}

// hijackableResponseWriter is a minimal http.ResponseWriter + http.Hijacker
// backed by a net.Pipe, used to prove the middleware preserves the Hijacker
// optional interface.
type hijackableResponseWriter struct {
	header http.Header
	mu     sync.Mutex
	body   []byte
	status int
}

func (w *hijackableResponseWriter) Header() http.Header {
	if w.header == nil {
		w.header = http.Header{}
	}
	return w.header
}

func (w *hijackableResponseWriter) Write(b []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.body = append(w.body, b...)
	return len(b), nil
}

func (w *hijackableResponseWriter) WriteHeader(code int) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.status = code
}

func (w *hijackableResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	c1, c2 := net.Pipe()
	return c1, bufio.NewReadWriter(bufio.NewReader(c2), bufio.NewWriter(c2)), nil
}

// pusherResponseWriter is a minimal http.ResponseWriter + http.Pusher used to
// prove the middleware preserves the Pusher optional interface.
type pusherResponseWriter struct {
	header  http.Header
	pushed  string
	pushErr error
}

func (w *pusherResponseWriter) Header() http.Header {
	if w.header == nil {
		w.header = http.Header{}
	}
	return w.header
}

func (w *pusherResponseWriter) Write(b []byte) (int, error) { return len(b), nil }

func (w *pusherResponseWriter) WriteHeader(code int) {}

func (w *pusherResponseWriter) Push(target string, opts *http.PushOptions) error {
	w.pushed = target
	return w.pushErr
}
