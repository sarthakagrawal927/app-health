// UUID v4 generation using the Node built-in Web Crypto implementation.
// Node 20+ exposes `globalThis.crypto.randomUUID`, so no dependency is needed.

/** Generate a fresh RFC 4122 v4 UUID string. */
export function randomUUID(): string {
  const c = globalThis.crypto as
    { randomUUID?: () => string; getRandomValues?: (arr: Uint8Array) => Uint8Array } | undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
      .slice(6, 8)
      .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
  }
  throw new Error(
    '@saas-maker/app-health: no Web Crypto implementation available to generate UUIDs',
  );
}
