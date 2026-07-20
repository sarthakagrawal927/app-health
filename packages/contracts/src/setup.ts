// V1 app, environment, and ingest-key setup contracts.
// Keys are scoped to one app and one environment. Only a non-reversible
// verifier is stored; the raw key is shown to the operator exactly once.

import { z } from 'zod';

export const AppV1 = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(128),
  created_at: z.number().int().min(0),
});

export type AppV1 = z.infer<typeof AppV1>;

export const EnvironmentV1 = z.object({
  id: z.string().min(1),
  app_id: z.string().min(1),
  name: z.string().trim().min(1).max(64),
  created_at: z.number().int().min(0),
});

export type EnvironmentV1 = z.infer<typeof EnvironmentV1>;

/** Stored key record. `verifier_hash` is the only persisted secret material. */
export const KeyRecordV1 = z.object({
  id: z.string().min(1),
  app_id: z.string().min(1),
  environment_id: z.string().min(1),
  verifier_hash: z.string().min(1),
  created_at: z.number().int().min(0),
  revoked_at: z.number().int().min(0).nullable(),
});

export type KeyRecordV1 = z.infer<typeof KeyRecordV1>;

/** One-time key display returned only at creation time. */
export const KeyDisplayV1 = z.object({
  key: z.string().min(1),
  app_id: z.string().min(1),
  environment_id: z.string().min(1),
  created_at: z.number().int().min(0),
});

export type KeyDisplayV1 = z.infer<typeof KeyDisplayV1>;

/** Request body accepted by the local app-creation endpoint. */
export const CreateAppRequestV1 = z.object({
  name: z.string().trim().min(1).max(128),
  environment: z.string().trim().min(1).max(64),
});

export type CreateAppRequestV1 = z.infer<typeof CreateAppRequestV1>;

/** Response returned by the local app-creation endpoint. */
export const CreateAppResponseV1 = z.object({
  app: AppV1,
  environment: EnvironmentV1,
  key: KeyDisplayV1,
});

export type CreateAppResponseV1 = z.infer<typeof CreateAppResponseV1>;
