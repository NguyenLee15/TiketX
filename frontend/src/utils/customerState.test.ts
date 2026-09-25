import { describe, expect, it } from 'vitest';
import {
  normalizePaymentStatus,
  parseCatalogState,
  clearCheckoutState,
  shouldPreserveSeatSelection,
  writeCatalogState,
} from './customerState';

describe('normalizePaymentStatus', () => {
  it.each([
    [0, 'Pending'], [1, 'Paid'], [2, 'Cancelled'], [3, 'Failed'], [4, 'Expired'],
    ['pending', 'Pending'], ['PAID', 'Paid'], ['Cancelled', 'Cancelled'], ['RefundPending', 'RefundPending'],
  ])('maps %s to %s', (input, expected) => {
    expect(normalizePaymentStatus(input)).toBe(expected);
  });

  it('keeps a processing server response pending', () => {
    expect(normalizePaymentStatus('Processing')).toBe('Pending');
  });

  it('maps an unknown/corrupted server response to Unknown', () => {
    expect(normalizePaymentStatus('UNKNOWN_STATUS_999')).toBe('Unknown');
    expect(normalizePaymentStatus(null)).toBe('Unknown');
  });
});

describe('seat ownership updates', () => {
  it('preserves a selected seat when the server says the lock belongs to this user', () => {
    expect(shouldPreserveSeatSelection('seat-1', {
      seatId: 'seat-1', status: 1, isLockedByCurrentUser: true,
    })).toBe(true);
  });

  it('clears a selected seat when another customer locks it', () => {
    expect(shouldPreserveSeatSelection('seat-1', {
      seatId: 'seat-1', status: 1, isLockedByCurrentUser: false,
    })).toBe(false);
  });
});

describe('checkout state', () => {
  it('clears reservation-derived state after a successful release', () => {
    expect(clearCheckoutState()).toEqual({
      ticketId: null,
      lockExpiresAt: null,
      lockTimeLeft: null,
    });
  });
});

describe('catalog URL state', () => {
  it('round-trips shareable filters and omits defaults', () => {
    const params = writeCatalogState({ search: 'rock', category: 'Concert', sort: 'price_asc', page: 3 });
    expect(params.toString()).toBe('search=rock&category=Concert&sort=price_asc&page=3');
    expect(parseCatalogState(params)).toEqual({ search: 'rock', category: 'Concert', sort: 'price_asc', page: 3 });
    expect(writeCatalogState({ search: '', category: 'All', sort: 'date_asc', page: 1 }).toString()).toBe('');
  });
});
