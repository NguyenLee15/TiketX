import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate } from './formatters';

describe('customer formatters', () => {
  it('formats VND through Intl', () => {
    expect(formatCurrency(125000)).toMatch(/125[.\s]000/);
  });

  it('returns a safe fallback for an invalid date', () => {
    expect(formatDate('not-a-date')).toBe('Chưa cập nhật');
  });
});
