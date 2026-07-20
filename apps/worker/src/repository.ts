// Repository interfaces for the V0 worker. These describe the storage shape
// the Cloudflare D1 implementation will satisfy in a later, deploy-approved
// change. V0 ships an in-memory implementation (see in-memory-adapter.ts) so
// the worker and its tests run credential-free.
//
// Every operation is scoped to an app and environment. Raw request events are
// never persisted: ingest updates one-minute aggregate buckets only.

import type {
  AppV1,
  BucketV1,
  EnvironmentV1,
  InstallationStatusV1,
  KeyRecordV1,
  Runtime,
} from '@app-health/contracts';

/** Persisted app records. */
export interface AppRepository {
  createApp(name: string, now: number): Promise<AppV1>;
  getApp(appId: string): Promise<AppV1 | null>;
}

/** Persisted environment records, scoped to an app. */
export interface EnvironmentRepository {
  createEnvironment(appId: string, name: string, now: number): Promise<EnvironmentV1>;
  getEnvironment(envId: string): Promise<EnvironmentV1 | null>;
}

/**
 * Persisted ingest keys. Only the non-reversible verifier is stored; the raw
 * key is returned to the caller exactly once at creation time.
 */
export interface KeyRepository {
  /** Create a new key and return the stored record plus the raw one-time key. */
  createKey(
    appId: string,
    envId: string,
    now: number,
  ): Promise<{
    record: KeyRecordV1;
    rawKey: string;
  }>;
  /** Look up a non-revoked key by its raw key string via the verifier hash. */
  verifyKey(rawKey: string): Promise<KeyRecordV1 | null>;
  /** Mark a key revoked; future ingest using it is rejected. */
  revokeKey(keyId: string, now: number): Promise<void>;
  /** Return the active (non-revoked) key for an environment, if any. */
  getActiveKeyForEnvironment(appId: string, envId: string): Promise<KeyRecordV1 | null>;
}

/** Installation verification state per (app_id, environment_id). */
export interface InstallationRepository {
  /** Record a successful ingest; updates first_seen/last_seen/runtime. */
  recordIngest(appId: string, envId: string, runtime: Runtime, now: number): Promise<void>;
  /** Read the installation status for the setup view. */
  getStatus(appId: string, envId: string, now: number): Promise<InstallationStatusV1>;
}

/**
 * Bounded deduplication of event IDs. Returns true when the event_id is newly
 * seen within the window, false when it is a duplicate.
 */
export interface DedupeRepository {
  markSeen(appId: string, envId: string, eventId: string, now: number): Promise<boolean>;
  /** Release a claim when aggregate persistence fails so the SDK can retry. */
  forget(appId: string, envId: string, eventId: string): Promise<void>;
}

/**
 * One-minute endpoint aggregate buckets. Ingest upserts; query reads a window
 * range and merges buckets in memory.
 */
export interface BucketRepository {
  /** Atomically add one event's contribution to its one-minute bucket. */
  upsertBucket(
    bucket: Omit<
      BucketV1,
      'request_count' | 'error_count' | 'duration_sum_ms' | 'last_seen' | 'histogram'
    > & {
      statusIsError: boolean;
      durationMs: number;
      timestamp: number;
    },
  ): Promise<void>;
  /** Return all buckets for the (app, environment) pair within [from, to]. */
  queryBuckets(appId: string, envId: string, from: number, to: number): Promise<BucketV1[]>;
}

/** Aggregate of all V0 repositories. The in-memory adapter implements this. */
export interface AppHealthRepositories {
  apps: AppRepository;
  environments: EnvironmentRepository;
  keys: KeyRepository;
  installation: InstallationRepository;
  dedupe: DedupeRepository;
  buckets: BucketRepository;
}
