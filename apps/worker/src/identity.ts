// Owner identity for V0. Production uses one high-entropy bearer secret kept
// in a Worker secret; local development remains credential-free.

/** A resolved local owner. The id is opaque and never persisted as user data. */
export interface OwnerIdentity {
  /** Stable opaque identifier for the local operator. */
  id: string;
  /** Human-readable label for diagnostics only. */
  label: string;
}

/**
 * Owner identity adapter. Outside local mode no adapter is configured, so
 * owner APIs fail closed. Ingest-key authentication is separate and does not
 * depend on this interface.
 */
export interface OwnerIdentityAdapter {
  /** Resolve the owner for the current request, or null if unauthenticated. */
  resolve(request: Request): Promise<OwnerIdentity | null> | OwnerIdentity | null;
}

/** Clearly-marked single-operator identity for local development only. */
export class LocalOwnerIdentityAdapter implements OwnerIdentityAdapter {
  private readonly owner: OwnerIdentity = {
    id: 'local-operator',
    label: 'local development operator',
  };

  resolve(): OwnerIdentity | null {
    return this.owner;
  }
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

/** Single-owner production identity backed by a Worker secret. */
export class BearerOwnerIdentityAdapter implements OwnerIdentityAdapter {
  private readonly expectedDigest: Promise<Uint8Array>;

  constructor(secret: string) {
    this.expectedDigest = digest(secret);
  }

  async resolve(request: Request): Promise<OwnerIdentity | null> {
    const token =
      request.headers
        .get('authorization')
        ?.match(/^Bearer\s+(.+)$/i)?.[1]
        ?.trim() ?? '';
    if (!token) return null;
    const [expected, received] = await Promise.all([this.expectedDigest, digest(token)]);
    if (!constantTimeEqual(expected, received)) return null;
    return { id: 'single-owner', label: 'App Health owner' };
  }
}
