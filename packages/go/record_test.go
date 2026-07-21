package apphealth

import (
	"context"
	"testing"
	"time"
)

func TestRecord_ValidatesAndQueuesFrameworkEvents(t *testing.T) {
	recorder := newRecordingServer()
	client := newTestClient(t, recorder, Config{FlushInterval: time.Hour})

	client.Record(RecordInput{
		Method:     " get ",
		Route:      "/users/:id",
		StatusCode: 204,
		Duration:   12 * time.Millisecond,
	})
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if err := client.Flush(ctx); err != nil {
		t.Fatalf("flush: %v", err)
	}

	events := recorder.events()
	if len(events) != 1 {
		t.Fatalf("expected one event, got %d", len(events))
	}
	event := events[0]
	if event.Method != "GET" || event.Route != "/users/:id" || event.StatusCode != 204 || event.DurationMs != 12 {
		t.Fatalf("unexpected event: %+v", event)
	}
}

func TestRecord_DropsSensitiveOrInvalidInput(t *testing.T) {
	client := New(Config{})
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = client.Close(ctx)
	})

	inputs := []RecordInput{
		{Method: "GET", Route: "/users/:id?token=secret", StatusCode: 200},
		{Method: "GET", Route: "users/:id", StatusCode: 200},
		{Method: "GET /", Route: "/users/:id", StatusCode: 200},
		{Method: "GET", Route: "/users/:id", StatusCode: 99},
		{Method: "GET", Route: "/users/:id", StatusCode: 200, Duration: -time.Millisecond},
	}
	for _, input := range inputs {
		client.Record(input)
	}
	if got := client.Stats().Dropped; got != int64(len(inputs)) {
		t.Fatalf("expected %d dropped events, got %d", len(inputs), got)
	}
}
