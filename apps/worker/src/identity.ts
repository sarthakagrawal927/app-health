// Owner identity for V0.
// Owner APIs (app creation, key revocation, endpoint queries) require an
// owner identity. Local development supplies a clearly marked single-operator
// adapter. Non-local execution without a configured production identity
// rejects owner API access (fail closed). Production identity selection and
// deployment remain a later, explicitly approved change.

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
