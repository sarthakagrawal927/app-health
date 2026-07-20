// Command apphealth-go-example runs a small net/http server instrumented with
// the app-health Go SDK middleware.
//
// Supply your ingest key and local ingest URL. The example never commits a
// key or env file. Provide the key via the --key flag or the
// APP_HEALTH_INGEST_KEY environment variable; provide the ingest URL via
// --ingest or APP_HEALTH_INGEST_URL (default http://localhost:8787/v1/ingest).
//
// Run from this directory:
//
//	go run . --key <your-ingest-key> --ingest http://localhost:8787/v1/ingest
//
// Point --ingest at an app-health Worker with authenticated V1 ingest enabled.
// The SDK fails open: application responses are unchanged while delivery
// errors are counted in the periodic stats line.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	apphealth "github.com/app-health/go"
)

func main() {
	keyFlag := flag.String("key", "", "ingest key (or set APP_HEALTH_INGEST_KEY)")
	ingestFlag := flag.String("ingest", "http://localhost:8787/v1/ingest", "v1 ingest URL (or set APP_HEALTH_INGEST_URL)")
	releaseFlag := flag.String("release", "example-0.1.0", "optional release tag")
	addrFlag := flag.String("addr", "127.0.0.1:8090", "example server listen address")
	flag.Parse()

	key := *keyFlag
	if key == "" {
		key = os.Getenv("APP_HEALTH_INGEST_KEY")
	}
	ingest := *ingestFlag
	if v := os.Getenv("APP_HEALTH_INGEST_URL"); v != "" {
		ingest = v
	}
	if key == "" {
		log.Fatal("app-health: supply --key or set APP_HEALTH_INGEST_KEY")
	}

	client := apphealth.New(apphealth.Config{
		IngestURL: ingest,
		IngestKey: key,
		Release:   *releaseFlag,
	})
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := client.Close(ctx); err != nil {
			log.Printf("app-health close: %v", err)
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, `{"ok":true}`)
	})
	mux.HandleFunc("GET /users/{id}", func(w http.ResponseWriter, r *http.Request) {
		// Simulate a small amount of work.
		time.Sleep(5 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"id":%q}`, r.PathValue("id"))
	})
	mux.HandleFunc("POST /orders", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		fmt.Fprintln(w, `{"created":true}`)
	})
	mux.HandleFunc("GET /oops", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintln(w, `{"error":"boom"}`)
	})

	// Wrap the entire mux with the app-health middleware.
	server := &http.Server{
		Addr:              *addrFlag,
		Handler:           client.Middleware(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Periodically print local diagnostic counters so the operator can see
	// batching, retries, and fail-open drops without enabling debug logging.
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			s := client.Stats()
			log.Printf("app-health stats: queued=%d sent=%d failed=%d retries=%d dropped=%d batches=%d",
				s.Queued, s.Sent, s.Failed, s.Retries, s.Dropped, s.BatchesSent)
		}
	}()

	log.Printf("app-health Go example listening on %s (ingest=%s)", *addrFlag, ingest)
	log.Printf("try: curl http://%s/health  |  curl http://%s/users/42  |  curl -X POST http://%s/orders", *addrFlag, *addrFlag, *addrFlag)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server: %v", err)
	}
}
