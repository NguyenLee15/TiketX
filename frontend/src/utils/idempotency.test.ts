import { describe, expect, it, vi } from 'vitest';
import { createIdempotencyKey, generateUuidV4Fallback, isValidUuidV4 } from './idempotency';

describe('Idempotency Key Utility', () => {
  it('generates valid RFC 4122 UUIDv4 strings using crypto.randomUUID', () => {
    for (let i = 0; i < 50; i++) {
      const key = createIdempotencyKey();
      expect(key).toHaveLength(36);
      expect(key[14]).toBe('4');
      expect(['8', '9', 'a', 'b']).toContain(key[19].toLowerCase());
      expect(isValidUuidV4(key)).toBe(true);
    }
  });

  it('generates valid UUIDv4 strings using fallback generator', () => {
    for (let i = 0; i < 50; i++) {
      const key = generateUuidV4Fallback();
      expect(key).toHaveLength(36);
      expect(key[14]).toBe('4');
      expect(['8', '9', 'a', 'b']).toContain(key[19].toLowerCase());
      expect(isValidUuidV4(key)).toBe(true);
    }
  });

  it('falls back seamlessly when crypto.randomUUID throws', () => {
    const spy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      throw new Error('Insecure context');
    });

    try {
      const key = createIdempotencyKey();
      expect(key).toHaveLength(36);
      expect(key[14]).toBe('4');
      expect(['8', '9', 'a', 'b']).toContain(key[19].toLowerCase());
      expect(isValidUuidV4(key)).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('rejects legacy prefixed keys and invalid formats', () => {
    expect(isValidUuidV4('checkout-12345')).toBe(false);
    expect(isValidUuidV4('release-ticket-id')).toBe(false);
    expect(isValidUuidV4('refund-ticket-id')).toBe(false);
    expect(isValidUuidV4('')).toBe(false);
    expect(isValidUuidV4('00000000-0000-0000-0000-000000000000')).toBe(false); // Nil UUID, not v4
    expect(isValidUuidV4('c8e6371e-2898-3a49-8ea1-b2f78b591b3f')).toBe(false); // v3 UUID, not v4
  });
});
