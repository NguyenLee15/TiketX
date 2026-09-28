import { describe, expect, it } from 'vitest';
import { DEFAULT_EVENT_DURATION_HOURS, getDefaultEventEndDate } from './eventModalSchemas';

describe('getDefaultEventEndDate', () => {
  it('adds the configured local wall-clock duration', () => {
    const start = new Date(2026, 0, 15, 20, 30);
    const end = getDefaultEventEndDate(start);

    expect(DEFAULT_EVENT_DURATION_HOURS).toBe(3);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(30);
  });

  it('returns an invalid date for invalid input', () => {
    expect(Number.isNaN(getDefaultEventEndDate('not-a-date').getTime())).toBe(true);
  });
});
