import { describe, expect, it } from 'vitest';
import { BearerOwnerIdentityAdapter } from '../src/identity.js';

describe('owner bearer identity', () => {
  const adapter = new BearerOwnerIdentityAdapter('aho_test-owner-secret');

  it('accepts only the configured bearer secret', async () => {
    const request = new Request('https://health.sassmaker.com/v1/apps', {
      headers: { authorization: 'Bearer aho_test-owner-secret' },
    });
    await expect(adapter.resolve(request)).resolves.toEqual({
      id: 'single-owner',
      label: 'App Health owner',
    });
  });

  it('rejects absent, malformed, and incorrect credentials', async () => {
    const attempts: HeadersInit[] = [
      {},
      { authorization: 'Basic aho_test-owner-secret' },
      { authorization: 'Bearer aho_wrong' },
    ];
    for (const headers of attempts) {
      await expect(
        adapter.resolve(new Request('https://health.sassmaker.com/v1/apps', { headers })),
      ).resolves.toBeNull();
    }
  });
});
