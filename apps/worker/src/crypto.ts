// Ingest key cryptography for V0.
// - Raw keys are random 32-byte values, hex-encoded with an `ahk_` prefix and
//   shown to the operator exactly once.
// - Only the SHA-256 verifier (hex digest of the raw key) is persisted. The
//   raw key cannot be recovered from the verifier.
// All primitives use the Web Crypto API available globally in Cloudflare
// Workers and Node 20+, so no runtime dependency is added.

/** Prefix for all app-health ingest keys. */
export const KEY_PREFIX = 'ahk_';
/** Number of random bytes in a raw key (32 bytes -> 64 hex chars). */
const KEY_RANDOM_BYTES = 32;

/** Generate a new random one-time ingest key. */
export function generateRawKey(): string {
  const bytes = new Uint8Array(KEY_RANDOM_BYTES);
  crypto.getRandomValues(bytes);
  return KEY_PREFIX + bytesToHex(bytes);
}

/** Compute the non-reversible SHA-256 verifier (hex) for a raw key. */
export async function hashKey(rawKey: string): Promise<string> {
  const data = new TextEncoder().encode(rawKey);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

/** True when a string is plausibly an app-health key (prefix + hex body). */
export function looksLikeKey(value: string): boolean {
  return value.startsWith(KEY_PREFIX) && value.length > KEY_PREFIX.length;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}
