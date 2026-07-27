import { describe, expect, it, vi } from 'vitest';
import { BearerOwnerIdentityAdapter } from '../src/identity.js';
import type { KeyRepository } from '../src/repository.js';

function keyRepository(record: Awaited<ReturnType<KeyRepository['verifyKey']>>): KeyRepository {
  return {
    verifyKey: vi.fn(async () => record),
  } as unknown as KeyRepository;
}

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

  it('resolves an active product key to its app scope before the global secret', async () => {
    const productKey = 'ahk_product-secret';
    const scoped = new BearerOwnerIdentityAdapter(
      productKey,
      keyRepository({
        id: 'key-polaris',
        app_id: 'app-polaris',
        environment_id: null,
        verifier_hash: 'stored',
        created_at: 1,
        revoked_at: null,
      }),
    );
    await expect(
      scoped.resolve(
        new Request('https://health.sassmaker.com/v1/apps', {
          headers: { authorization: `Bearer ${productKey}` },
        }),
      ),
    ).resolves.toEqual({
      id: 'key-polaris',
      label: 'App Health product',
      appId: 'app-polaris',
    });
  });

  it('rejects legacy environment keys and revoked or unknown product keys', async () => {
    const legacy = new BearerOwnerIdentityAdapter(
      'aho_global-owner',
      keyRepository({
        id: 'key-legacy',
        app_id: 'app-polaris',
        environment_id: 'env-staging',
        verifier_hash: 'stored',
        created_at: 1,
        revoked_at: null,
      }),
    );
    const revoked = new BearerOwnerIdentityAdapter('aho_global-owner', keyRepository(null));
    const request = new Request('https://health.sassmaker.com/v1/apps', {
      headers: { authorization: 'Bearer ahk_not-product-scoped' },
    });
    await expect(legacy.resolve(request)).resolves.toBeNull();
    await expect(revoked.resolve(request)).resolves.toBeNull();
  });
});
