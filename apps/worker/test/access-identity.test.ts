import { describe, expect, it } from 'vitest';
import { CloudflareAccessIdentityAdapter } from '../src/access-identity.js';

function encode(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function fixture() {
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  Object.assign(jwk, { kid: 'key-1', alg: 'RS256', use: 'sig' });
  const now = 1_725_000_000;
  async function token(overrides: Record<string, unknown> = {}) {
    const header = encode({ alg: 'RS256', kid: 'key-1' });
    const payload = encode({
      iss: 'https://team.cloudflareaccess.com',
      aud: ['app-aud'],
      exp: now + 60,
      email: 'owner@example.com',
      sub: 'owner-1',
      ...overrides,
    });
    const signature = new Uint8Array(
      await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        pair.privateKey,
        new TextEncoder().encode(`${header}.${payload}`),
      ),
    );
    const encodedSignature = btoa(String.fromCharCode(...signature))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    return `${header}.${payload}.${encodedSignature}`;
  }
  const adapter = new CloudflareAccessIdentityAdapter({
    issuer: 'https://team.cloudflareaccess.com',
    audience: 'app-aud',
    ownerEmail: 'owner@example.com',
    now: () => now * 1000,
    fetchImpl: async () => Response.json({ keys: [jwk] }),
  });
  return { adapter, token };
}

describe('Cloudflare Access identity', () => {
  it('rejects an absent assertion without fetching keys', async () => {
    const { adapter } = await fixture();
    await expect(adapter.resolve(new Request('https://health.sassmaker.com'))).resolves.toBeNull();
  });

  it('accepts a signed, scoped, unexpired assertion for the owner', async () => {
    const { adapter, token } = await fixture();
    const request = new Request('https://health.sassmaker.com', {
      headers: { 'cf-access-jwt-assertion': await token() },
    });
    await expect(adapter.resolve(request)).resolves.toEqual({
      id: 'owner-1',
      label: 'owner@example.com',
    });
  });

  it('rejects wrong owner, audience, expiry, and tampering', async () => {
    const { adapter, token } = await fixture();
    for (const assertion of [
      await token({ email: 'other@example.com' }),
      await token({ aud: ['other-aud'] }),
      await token({ exp: 1 }),
      `${await token()}x`,
    ]) {
      const request = new Request('https://health.sassmaker.com', {
        headers: { 'cf-access-jwt-assertion': assertion },
      });
      await expect(adapter.resolve(request)).resolves.toBeNull();
    }
  });
});
