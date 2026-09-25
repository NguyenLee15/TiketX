import { describe, it, expect } from 'vitest';
import {
  catalogResponseSchema,
  eventDetailSchema,
  ticketsResponseSchema,
  ticketItemSchema,
} from './useCustomerQueries';

describe('Zod Schema Contract Synchronization Tests', () => {
  it('should validate actual backend EventDto catalog response successfully', () => {
    const backendCatalogPayload = {
      items: [
        {
          id: 'b6f9c94b-4b24-4f81-bfeb-404399e52e98',
          title: 'Hòa nhạc Mùa Thu Hà Nội',
          description: 'Đêm nhạc thính phòng đặc biệt',
          date: '2026-11-20T19:30:00Z',
          endDate: '2026-11-20T22:30:00Z',
          location: 'Nhà Hát Lớn Hà Nội',
          venueName: 'Khán phòng chính',
          category: 'Music',
          imageUrl: 'https://example.com/banner.jpg',
          bannerUrl: 'https://example.com/banner-lg.jpg',
          organizerName: 'Symphony Orchestra',
          totalSeats: 500,
          availableSeatsCount: 120,
          basePrice: 500000,
          minPrice: 500000,
          maxPrice: 1500000,
          status: 1, // Published
          refundCutoffHours: 48,
          isDeleted: false,
          hasTicketHistory: true,
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 10,
      totalPages: 1,
    };

    const parsed = catalogResponseSchema.safeParse(backendCatalogPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.items[0].title).toBe('Hòa nhạc Mùa Thu Hà Nội');
      expect(parsed.data.items[0].basePrice).toBe(500000);
      expect(parsed.data.items[0].availableSeatsCount).toBe(120);
    }
  });

  it('should validate actual backend EventDetailDto with seats successfully', () => {
    const backendDetailPayload = {
      id: 'b6f9c94b-4b24-4f81-bfeb-404399e52e98',
      title: 'Hòa nhạc Mùa Thu Hà Nội',
      description: 'Đêm nhạc thính phòng đặc biệt',
      date: '2026-11-20T19:30:00Z',
      endDate: '2026-11-20T22:30:00Z',
      location: 'Nhà Hát Lớn Hà Nội',
      venueName: 'Khán phòng chính',
      category: 'Music',
      imageUrl: 'https://example.com/banner.jpg',
      bannerUrl: 'https://example.com/banner-lg.jpg',
      organizerName: 'Symphony Orchestra',
      totalSeats: 1,
      availableSeatsCount: 1,
      basePrice: 500000,
      minPrice: 500000,
      maxPrice: 500000,
      status: 'Published',
      refundCutoffHours: 48,
      seats: [
        {
          id: 'seat-uuid-1',
          eventId: 'b6f9c94b-4b24-4f81-bfeb-404399e52e98',
          row: 'A',
          number: 1,
          tier: 1,
          status: 0,
          price: 500000,
          version: 'v1-lock',
          isLockedByCurrentUser: false,
        },
      ],
    };

    const parsed = eventDetailSchema.safeParse(backendDetailPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe('Hòa nhạc Mùa Thu Hà Nội');
      expect(parsed.data.seats).toHaveLength(1);
      expect(parsed.data.seats[0].row).toBe('A');
    }
  });

  it('should validate TicketDto with 18-digit OrderCode preserving exact string precision', () => {
    const orderCode18Digits = '202609251439123456';
    const backendTicketPayload = {
      id: 'ticket-uuid-1',
      eventId: 'b6f9c94b-4b24-4f81-bfeb-404399e52e98',
      seatId: 'seat-uuid-1',
      eventTitle: 'Hòa nhạc Mùa Thu Hà Nội',
      eventDescription: 'Đêm nhạc',
      eventDate: '2026-11-20T19:30:00Z',
      endDate: '2026-11-20T22:30:00Z',
      location: 'Hà Nội',
      venueName: 'Nhà hát lớn',
      category: 'Music',
      imageUrl: 'https://example.com/thumb.jpg',
      row: 'A',
      number: 1,
      tier: 1,
      price: 500000,
      status: 'Paid',
      orderCode: orderCode18Digits,
      qrCodeSignature: 'sig-token-abc',
      paidAt: '2026-09-25T14:40:00Z',
      checkedInAt: null,
      refundAmount: null,
      refundedAt: null,
      refundCutoffHours: 24,
      canRefund: true,
    };

    const parsed = ticketItemSchema.safeParse(backendTicketPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.orderCode).toBe(orderCode18Digits);
      expect(parsed.data.eventTitle).toBe('Hòa nhạc Mùa Thu Hà Nội');
      expect(parsed.data.canRefund).toBe(true);
    }

    const arrayParsed = ticketsResponseSchema.safeParse([backendTicketPayload]);
    expect(arrayParsed.success).toBe(true);
  });

  it('should reject malformed data in Fail-Closed mode', () => {
    const corruptPayload = {
      // Missing required id, title, date, etc.
      someRandomField: 12345,
    };

    const parsed = eventDetailSchema.safeParse(corruptPayload);
    expect(parsed.success).toBe(false);
  });
});
