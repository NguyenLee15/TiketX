import { describe, expect, it } from 'vitest';
import { eventStatusToFormValue, formValueToEventStatus } from './adminEventState';

describe('admin event status mapping', () => {
  it.each([
    [0, 'Draft'],
    [1, 'Published'],
    [2, 'Completed'],
    [3, 'Cancelled'],
    ['Draft', 'Draft'],
    ['Published', 'Published'],
    ['Completed', 'Completed'],
    ['Cancelled', 'Cancelled'],
  ] as const)('preserves %s as %s when an event is opened for editing', (status, expected) => {
    expect(eventStatusToFormValue(status)).toBe(expected);
  });

  it.each([
    ['Draft', 0],
    ['Published', 1],
    ['Completed', 2],
    ['Cancelled', 3],
  ] as const)('serializes %s as backend enum %s', (value, expected) => {
    expect(formValueToEventStatus(value)).toBe(expected);
  });
});
