import { describe, expect, it } from 'vitest';
import { readCsrfToken } from './csrf';

describe('readCsrfToken', () => {
  it('reads the double-submit token without decoding unrelated cookies', () => {
    expect(readCsrfToken('theme=dark; XSRF-TOKEN=abc123%2Ftoken; other=value')).toBe('abc123/token');
  });

  it('returns null when the CSRF cookie is absent', () => {
    expect(readCsrfToken('theme=dark')).toBeNull();
  });
});
