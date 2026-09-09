export type SeatTier = 0 | 1 | 2; // 0: Standard, 1: VIP, 2: Economy
export type SeatStatus = 0 | 1 | 2; // 0: Available, 1: Locked, 2: Sold
export type TicketStatus = 0 | 1 | 2 | 3 | 4; // 0: Pending, 1: Paid, 2: Cancelled, 3: Used, 4: RefundPending
export type EventStatus = 0 | 1 | 2 | 3 | 'Draft' | 'Published' | 'Completed' | 'Cancelled';

export interface TicketType {
  name: string;
  price: number;
  totalQuantity: number;
  availableQuantity?: number;
}

export interface Seat {
  id: string;
  eventId: string;
  row: string;
  number: number;
  tier: SeatTier;
  status: SeatStatus;
  price: number;
  version: string;
  isLockedByMe?: boolean;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  endDate?: string;
  location: string;
  venueName?: string;
  category: string;
  imageUrl: string;
  bannerUrl?: string;
  organizerName?: string;
  totalSeats: number;
  availableSeatsCount?: number;
  basePrice: number;
  minPrice?: number;
  maxPrice?: number;
  status: EventStatus;
  refundCutoffHours?: number;
  isDeleted?: boolean;
  ticketTypes?: TicketType[];
}

export interface EventDetail extends Event {
  seats: Seat[];
}

export interface TicketData {
  id: string;
  eventId: string;
  seatId: string;
  userId?: string;
  eventTitle: string;
  eventDate: string;
  location: string;
  venueName?: string;
  row: string;
  number: number;
  tier?: SeatTier | string;
  price: number;
  status: string; // 'Pending' | 'Paid' | 'Cancelled' | 'Used'
  orderCode: number;
  qrCodeSignature?: string;
  paidAt?: string;
  checkedInAt?: string;
  refundAmount?: number;
  refundedAt?: string;
}

export interface SeatStatusChangedPayload {
  seatId?: string;
  SeatId?: string;
  id?: string;
  status?: string | number;
  Status?: string | number;
  isLockedByMe?: boolean;
  isLockedByCurrentUser?: boolean;
  reservationOwnerId?: string;
  version?: string;
  expiresAt?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  code?: string;
  message?: string;
  data: T;
  errors?: string[];
}

export interface ApiErrorResponse {
  success: false;
  code?: string;
  message: string;
  errors?: string[];
}

export interface JwtTokenPayload {
  sub?: string;
  name?: string;
  email?: string;
  role?: string;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: string;
}
