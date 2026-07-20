// V1 installation-status contract. The setup view reports whether a valid
// event has been received for a key and identifies runtime, environment,
// first seen, and last seen when available.

import { z } from 'zod';
import {
  INSTALLATION_STATES,
  RUNTIMES,
  type InstallationState,
  type Runtime,
} from './constants.js';

export const InstallationStatusV1 = z.object({
  state: z.enum(INSTALLATION_STATES) as z.ZodEnum<[InstallationState, ...InstallationState[]]>,
  runtime: z.enum(RUNTIMES).optional() as
    z.ZodEnum<[Runtime, ...Runtime[]]> | z.ZodOptional<z.ZodEnum<[Runtime, ...Runtime[]]>>,
  first_seen: z.number().int().min(0).nullable(),
  last_seen: z.number().int().min(0).nullable(),
  /** Short, bounded next-action instruction shown to the operator. */
  next_action: z.string().min(1).max(280),
});

export type InstallationStatusV1 = z.infer<typeof InstallationStatusV1>;
