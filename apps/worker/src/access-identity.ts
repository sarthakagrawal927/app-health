import type { OwnerIdentity, OwnerIdentityAdapter } from './identity.js';

interface Jwk extends JsonWebKey {
  kid?: string;
}
interface JwtHeader {
  alg?: string;
  kid?: string;
}
interface JwtClaims {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  email?: string;
  sub?: string;
}

export class CloudflareAccessIdentityAdapter implements OwnerIdentityAdapter {
  private keys: Map<string, CryptoKey> | null = null;

  constructor(
    private readonly options: {
      issuer: string;
      audience: string;
      ownerEmail: string;
      fetchImpl?: typeof fetch;
      now?: () => number;
    },
  ) {}

  async resolve(request: Request): Promise<OwnerIdentity | null> {
    try {
      const token = request.headers.get('cf-access-jwt-assertion');
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const header = decodeJson<JwtHeader>(parts[0]);
      const claims = decodeJson<JwtClaims>(parts[1]);
      if (header.alg !== 'RS256' || !header.kid) return null;
      const key = (await this.loadKeys()).get(header.kid);
      if (!key) return null;
      const valid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        key,
        decodeBase64Url(parts[2]),
        new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
      );
      if (!valid) return null;
      const now = Math.floor((this.options.now?.() ?? Date.now()) / 1000);
      const issuer = this.options.issuer.replace(/\/$/, '');
      const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (claims.iss?.replace(/\/$/, '') !== issuer) return null;
      if (!audiences.includes(this.options.audience)) return null;
      if (!claims.exp || claims.exp <= now || (claims.nbf !== undefined && claims.nbf > now))
        return null;
      if (claims.email?.toLowerCase() !== this.options.ownerEmail.toLowerCase()) return null;
      return { id: claims.sub ?? claims.email, label: claims.email };
    } catch {
      return null;
    }
  }

  private async loadKeys(): Promise<Map<string, CryptoKey>> {
    if (this.keys) return this.keys;
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(
      `${this.options.issuer.replace(/\/$/, '')}/cdn-cgi/access/certs`,
    );
    if (!response.ok) throw new Error(`Access JWKS request failed: ${response.status}`);
    const payload = (await response.json()) as { keys?: Jwk[] };
    const keys = new Map<string, CryptoKey>();
    for (const jwk of payload.keys ?? []) {
      if (!jwk.kid || jwk.kty !== 'RSA') continue;
      keys.set(
        jwk.kid,
        await crypto.subtle.importKey(
          'jwk',
          jwk,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify'],
        ),
      );
    }
    this.keys = keys;
    return keys;
  }
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
