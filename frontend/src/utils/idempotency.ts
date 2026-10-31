/**
 * Generates an RFC 4122 compliant UUIDv4 idempotency key.
 * Strictly satisfies backend IdempotentAttribute:
 * - Length: 36 characters (format "D": 8-4-4-4-12 hex with hyphens)
 * - Version: '4' at index 14
 * - Variant: '8' | '9' | 'a' | 'b' | 'A' | 'B' at index 19
 */
export function generateUuidV4Fallback(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      return generateUuidV4Fallback();
    }
  }
  return generateUuidV4Fallback();
}

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuidV4(input: string): boolean {
  return UUID_V4_REGEX.test(input);
}
