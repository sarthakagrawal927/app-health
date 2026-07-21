package apphealth

import "os"

const DefaultIngestURL = "https://ingest.sassmaker.com/v1/ingest"

// NewFromEnvironment creates a client only when APP_HEALTH_ENABLED is true,
// APP_ENV matches the required environment, and APP_HEALTH_INGEST_KEY exists.
// It returns nil otherwise.
// The optional endpoint argument overrides DefaultIngestURL when non-empty.
func NewFromEnvironment(project, requiredEnvironment, endpoint string) *Client {
	if os.Getenv("APP_HEALTH_ENABLED") != "true" {
		return nil
	}
	if requiredEnvironment == "" || os.Getenv("APP_ENV") != requiredEnvironment {
		return nil
	}
	key := os.Getenv("APP_HEALTH_INGEST_KEY")
	if key == "" {
		return nil
	}
	if endpoint == "" {
		endpoint = os.Getenv("APP_HEALTH_INGEST_URL")
	}
	if endpoint == "" {
		endpoint = DefaultIngestURL
	}
	return New(Config{IngestURL: endpoint, IngestKey: key, Project: project, Environment: requiredEnvironment, Release: os.Getenv("APP_VERSION")})
}
