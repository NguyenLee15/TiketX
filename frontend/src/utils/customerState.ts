import type { SeatStatusChangedPayload } from '../types';

export type PaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Cancelled' | 'Expired' | 'RefundPending' | 'Used' | 'Unknown';

export const normalizePaymentStatus = (value: unknown): PaymentStatus => {
  if (value === 1 || String(value).toLowerCase() === 'paid') return 'Paid';
  if (value === 2 || String(value).toLowerCase() === 'cancelled' || String(value).toLowerCase() === 'canceled') return 'Cancelled';
  if (value === 3 || String(value).toLowerCase() === 'failed') return 'Failed';
  if (value === 4 || String(value).toLowerCase() === 'expired') return 'Expired';
  if (String(value).toLowerCase() === 'refundpending' || String(value).toLowerCase() === 'refund_pending') return 'RefundPending';
  if (String(value).toLowerCase() === 'used') return 'Used';
  if (value === 0 || String(value).toLowerCase() === 'pending' || String(value).toLowerCase() === 'processing') return 'Pending';
  return 'Unknown';
};

export const shouldPreserveSeatSelection = (selectedSeatId: string, payload: SeatStatusChangedPayload) =>
  payload.seatId !== selectedSeatId || payload.status === 0 || payload.isLockedByCurrentUser === true || payload.isLockedByMe === true;

export const clearCheckoutState = () => ({
  ticketId: null as string | null,
  lockExpiresAt: null as string | null,
  lockTimeLeft: null as number | null,
});

export interface CatalogState { search: string; category: string; sort: string; page: number }
export const parseCatalogState = (params: URLSearchParams): CatalogState => ({
  search: params.get('search') ?? '',
  category: params.get('category') ?? 'All',
  sort: params.get('sort') ?? 'date_asc',
  page: Math.max(1, Number(params.get('page')) || 1),
});
export const writeCatalogState = (state: CatalogState) => {
  const params = new URLSearchParams();
  if (state.search.trim()) params.set('search', state.search.trim());
  if (state.category !== 'All') params.set('category', state.category);
  if (state.sort !== 'date_asc') params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));
  return params;
};
