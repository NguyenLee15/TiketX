import { describe, expect, it } from 'vitest';
import {
  normalizePaymentStatus,
  parseCatalogState,
  clearCheckoutState,
  shouldPreserveSeatSelection,
  writeCatalogState,
  shouldShowFeaturedHero,
  getEventDisplayPrice,
} from './customerState';
import { toPdfSafeText } from './ticketPdfGenerator';

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

describe('catalog featured and pricing helpers', () => {
  it('only shows featured hero on page 1 with default catalog filters', () => {
    expect(shouldShowFeaturedHero({ search: '', category: 'All', sort: 'date_asc', page: 1 }, 3)).toBe(true);
    expect(shouldShowFeaturedHero({ search: 'rock', category: 'All', sort: 'date_asc', page: 1 }, 3)).toBe(false);
    expect(shouldShowFeaturedHero({ search: '', category: 'Music', sort: 'date_asc', page: 1 }, 3)).toBe(false);
    expect(shouldShowFeaturedHero({ search: '', category: 'All', sort: 'price_asc', page: 1 }, 3)).toBe(false);
    expect(shouldShowFeaturedHero({ search: '', category: 'All', sort: 'date_asc', page: 2 }, 3)).toBe(false);
    expect(shouldShowFeaturedHero({ search: '', category: 'All', sort: 'date_asc', page: 1 }, 0)).toBe(false);
  });

  it('prefers minPrice when positive, falling back to basePrice', () => {
    expect(getEventDisplayPrice({ basePrice: 200000, minPrice: 150000 })).toBe(150000);
    expect(getEventDisplayPrice({ basePrice: 200000, minPrice: 0 })).toBe(200000);
    expect(getEventDisplayPrice({ basePrice: 200000 })).toBe(200000);
  });

  it('converts Vietnamese text to safe ASCII for PDF generation', () => {
    expect(toPdfSafeText('Đêm Nhạc Sơn Tùng M-TP — Hà Nội')).toBe('Dem Nhac Son Tung M-TP - Ha Noi');
    expect(toPdfSafeText('Trung Tâm Hội Nghị Quốc Gia')).toBe('Trung Tam Hoi Nghi Quoc Gia');
    expect(toPdfSafeText(null)).toBe('');
  });
});

