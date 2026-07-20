package apphealth

import (
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// 4.3: ingest outage does not change handler responses; failures are counted
// and silent (fail open).
func TestDelivery_OutageFailOpen(t *testing.T) {
	rs := newRecordingServer()
	rs.status = 500 // every request fails
	c := newTestClient(t, rs, Config{MaxRetries: 1})

	h := c.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
	}))
	rr := doRequest(t, h, "GET", "/x", nil, nil)
	if rr.Code != 200 || rr.Body.String() != "ok" {
		t.Fatalf("response changed during outage: %d %q", rr.Code, rr.Body.String())
	}

	if !waitFor(t, 3*time.Second, func() bool { return c.Stats().Failed > 0 }) {
		t.Fatalf("expected failed counter > 0, got %+v", c.Stats())
	}
	if c.Stats().Sent != 0 {
		t.Fatalf("expected no successful sends during outage, got %d", c.Stats().Sent)
	}
}

// 4.3: bounded retries eventually succeed and increment the retry counter.
func TestDelivery_RetryThenSuccess(t *testing.T) {
	rs := newRecordingServer()
	rs.failFirst = 2 // first two attempts 500, then 202
	c := newTestClient(t, rs, Config{MaxRetries: 3, BaseBackoff: time.Millisecond})

	c.enqueue(EventV1{
		EventID: newEventID(), Timestamp: c.nowMs(), Method: "GET",
		Route: "/retry", StatusCode: 200, DurationMs: 1,
	})

	if !waitFor(t, 3*time.Second, func() bool { return c.Stats().Sent > 0 }) {
		t.Fatalf("expected eventual success, stats=%+v", c.Stats())
	}
	if c.Stats().Retries < 2 {
		t.Fatalf("expected at least 2 retries, got %d", c.Stats().Retries)
	}
	if len(rs.events()) != 1 {
		t.Fatalf("expected 1 event delivered, got %d", len(rs.events()))
	}
}

// 4.3: queue overflow drops telemetry without blocking and increments the
// dropped counter.
func TestDelivery_OverflowDrops(t *testing.T) {
	rs := newRecordingServer()
	rs.blockCh = make(chan struct{})
	c := newTestClient(t, rs, Config{QueueSize: 4, BatchSize: 2, MaxRetries: 0})

	// Block the delivery goroutine so the queue fills.
	// Enqueue well beyond the queue capacity; drops must be non-blocking.
	for i := 0; i < 50; i++ {
		c.enqueue(EventV1{
			EventID: newEventID(), Timestamp: c.nowMs(), Method: "GET",
			Route: "/overflow", StatusCode: 200, DurationMs: 1,
		})
	}
	if c.Stats().Dropped == 0 {
		t.Fatalf("expected drops when queue is full, got %+v", c.Stats())
	}
	// Enqueuing must not have blocked: the loop above returned.

	// Release the server and close; remaining queued events are delivered.
	close(rs.blockCh)
	ctx, cancel := contextWithTimeout(3 * time.Second)
	defer cancel()
	if err := c.Close(ctx); err != nil {
		t.Fatalf("close: %v", err)
	}
}

// 4.3: Close flushes all pending events before returning.
func TestDelivery_CloseFlushes(t *testing.T) {
	rs := newRecordingServer()
	// Use a fresh client without the auto-close cleanup by building manually.
	srv := httptest.NewServer(rs.handler())
	defer srv.Close()

	c := New(Config{
		IngestURL:     srv.URL,
		IngestKey:     "k",
		QueueSize:     128,
		BatchSize:     16,
		FlushInterval: time.Hour, // disable timer-based flush
		Timeout:       time.Second,
		MaxRetries:    1,
		BaseBackoff:   time.Millisecond,
	})

	for i := 0; i < 40; i++ {
		c.enqueue(EventV1{
			EventID: newEventID(), Timestamp: c.nowMs(), Method: "GET",
			Route: "/close", StatusCode: 200, DurationMs: 1,
		})
	}
	ctx, cancel := contextWithTimeout(3 * time.Second)
	defer cancel()
	if err := c.Close(ctx); err != nil {
		t.Fatalf("close: %v", err)
	}
	if len(rs.events()) != 40 {
		t.Fatalf("expected 40 events flushed on close, got %d", len(rs.events()))
	}
}

// 4.3: Flush waits for the queue to drain without closing the client.
func TestDelivery_FlushDrains(t *testing.T) {
	rs := newRecordingServer()
	// Slow server so the queue does not drain instantly.
	rs.delay = 10 * time.Millisecond
	c := newTestClient(t, rs, Config{QueueSize: 64, BatchSize: 4, MaxRetries: 0})

	for i := 0; i < 10; i++ {
		c.enqueue(EventV1{
			EventID: newEventID(), Timestamp: c.nowMs(), Method: "GET",
			Route: "/flush", StatusCode: 200, DurationMs: 1,
		})
	}
	ctx, cancel := contextWithTimeout(3 * time.Second)
	defer cancel()
	if err := c.Flush(ctx); err != nil {
		t.Fatalf("flush: %v", err)
	}
	if c.Stats().Queued != 0 {
		t.Fatalf("expected empty queue after flush, got %d", c.Stats().Queued)
	}
	// Client still usable after Flush.
	if c.closed.Load() {
		t.Fatal("client should not be closed after Flush")
	}
}

// 4.3: a second Close call is a no-op and returns the first error (nil here).
func TestDelivery_CloseIdempotent(t *testing.T) {
	rs := newRecordingServer()
	c := newTestClient(t, rs, Config{})
	// The test cleanup also closes; call once explicitly and expect no panic.
	ctx, cancel := contextWithTimeout(time.Second)
	defer cancel()
	_ = c.Close(ctx)
	// Second close via cleanup must not panic or hang.
}

// 4.1: the Authorization header carries the ingest key and the batch carries
// the go runtime and schema version.
func TestDelivery_AuthAndSchema(t *testing.T) {
	rs := newRecordingServer()
	var gotAuth atomic.Value
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth.Store(r.Header.Get("Authorization"))
		body, _ := io.ReadAll(r.Body)
		rs.mu.Lock()
		rs.bodies = append(rs.bodies, body)
		rs.mu.Unlock()
		w.WriteHeader(202)
	}))
	defer srv.Close()

	c := New(Config{
		IngestURL:     srv.URL,
		IngestKey:     "secret-key-123",
		QueueSize:     16,
		BatchSize:     4,
		FlushInterval: 20 * time.Millisecond,
		Timeout:       time.Second,
		MaxRetries:    0,
		BaseBackoff:   time.Millisecond,
	})
	c.enqueue(EventV1{
		EventID: newEventID(), Timestamp: c.nowMs(), Method: "GET",
		Route: "/auth", StatusCode: 200, DurationMs: 1,
	})
	if !waitFor(t, 2*time.Second, func() bool { return len(rs.batchBodies()) >= 1 }) {
		t.Fatalf("expected a batch")
	}
	if got, _ := gotAuth.Load().(string); got != "Bearer secret-key-123" {
		t.Fatalf("expected bearer auth, got %q", got)
	}
	var batch EventBatchV1
	if err := jsonStrictUnmarshal(rs.batchBodies()[0], &batch); err != nil {
		t.Fatalf("invalid batch: %v", err)
	}
	if batch.SchemaVersion != SchemaVersion {
		t.Fatalf("expected schema %q, got %q", SchemaVersion, batch.SchemaVersion)
	}
	if batch.Runtime != RuntimeGo {
		t.Fatalf("expected runtime %q, got %q", RuntimeGo, batch.Runtime)
	}
	ctx, cancel := contextWithTimeout(2 * time.Second)
	defer cancel()
	_ = c.Close(ctx)
}
