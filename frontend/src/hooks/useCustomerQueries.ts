import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import api from '../services/api';
import { Event, EventDetail } from '../types';
import { TicketItemData } from '../pages/Tickets/TicketCard';

export const eventItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().default(''),
  date: z.string(),
  endDate: z.string().optional().nullable(),
  location: z.string().default(''),
  venueName: z.string().optional().default(''),
  category: z.string().default(''),
  imageUrl: z.string().default(''),
  bannerUrl: z.string().optional().default(''),
  organizerName: z.string().optional().default(''),
  totalSeats: z.number().default(0),
  availableSeatsCount: z.number().optional().default(0),
  basePrice: z.number().default(0),
  minPrice: z.number().optional().default(0),
  maxPrice: z.number().optional().default(0),
  status: z.union([z.number(), z.string()]),
  refundCutoffHours: z.number().optional().default(24),
  isDeleted: z.boolean().optional().default(false),
  hasTicketHistory: z.boolean().optional().default(false),
}).passthrough();

export const catalogResponseSchema = z.object({
  items: z.array(eventItemSchema).default([]),
  totalPages: z.number().default(1),
  totalCount: z.number().default(0),
  page: z.number().optional().default(1),
  pageSize: z.number().optional().default(10),
}).passthrough();

export const seatSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  row: z.string(),
  number: z.number(),
  tier: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? Number(v) || 0 : v),
  status: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? Number(v) || 0 : v),
  price: z.number(),
  version: z.string(),
  isLockedByCurrentUser: z.boolean().optional().default(false),
}).passthrough();

export const eventDetailSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().default(''),
  date: z.string(),
  endDate: z.string().optional().nullable(),
  location: z.string().default(''),
  venueName: z.string().optional().default(''),
  category: z.string().default(''),
  imageUrl: z.string().default(''),
  bannerUrl: z.string().optional().default(''),
  organizerName: z.string().optional().default(''),
  totalSeats: z.number().default(0),
  availableSeatsCount: z.number().optional().default(0),
  basePrice: z.number().default(0),
  minPrice: z.number().optional().default(0),
  maxPrice: z.number().optional().default(0),
  status: z.union([z.number(), z.string()]),
  refundCutoffHours: z.number().optional().default(24),
  seats: z.array(seatSchema).default([]),
}).passthrough();

export const ticketItemSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  seatId: z.string(),
  eventTitle: z.string(),
  eventDescription: z.string().optional().default(''),
  eventDate: z.string(),
  endDate: z.string().optional().default(''),
  location: z.string().default(''),
  venueName: z.string().optional().default(''),
  category: z.string().optional().default(''),
  imageUrl: z.string().optional().default(''),
  row: z.string(),
  number: z.number(),
  tier: z.union([z.number(), z.string()]).transform(v => typeof v === 'string' ? Number(v) || 0 : v),
  price: z.number(),
  status: z.string(),
  orderCode: z.union([z.string(), z.number()]).transform(v => String(v)),
  qrCodeSignature: z.string().optional().default(''),
  paidAt: z.string().optional().nullable(),
  checkedInAt: z.string().optional().nullable(),
  refundAmount: z.number().optional().nullable(),
  refundedAt: z.string().optional().nullable(),
  refundCutoffHours: z.number().optional().default(24),
  canRefund: z.boolean().optional().default(false),
}).passthrough();

export const ticketsResponseSchema = z.array(ticketItemSchema);

export interface CatalogQueryOptions {
  page: number;
  pageSize?: number;
  search?: string;
  category?: string;
  sort?: string;
}

export interface CatalogQueryResult {
  items: Event[];
  totalPages: number;
  totalCount: number;
}

export function useEventsCatalogQuery(options: CatalogQueryOptions) {
  const { page, pageSize = 6, search = '', category = 'All', sort = 'date_asc' } = options;

  return useQuery<CatalogQueryResult>({
    queryKey: ['events', 'catalog', { page, pageSize, search: search.trim(), category, sort }],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy: sort,
      });
      if (search.trim()) params.append('search', search.trim());
      if (category && category !== 'All') params.append('category', category);

      const response = await api.get(`/api/events?${params.toString()}`, { signal });
      if (!response.data.success) {
        throw new Error(response.data.message || 'Không thể tải danh sách sự kiện');
      }

      const parsed = catalogResponseSchema.safeParse(response.data.data);
      if (!parsed.success) {
        const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
        throw new Error(`Dữ liệu danh mục sự kiện không hợp lệ từ máy chủ: ${issues}`);
      }

      return {
        items: parsed.data.items as Event[],
        totalPages: parsed.data.totalPages,
        totalCount: parsed.data.totalCount,
      };
    },
    staleTime: 3 * 60 * 1000,
  });
}

export function useEventDetailQuery(eventId: string | undefined) {
  return useQuery<EventDetail>({
    queryKey: ['events', 'detail', eventId],
    queryFn: async ({ signal }) => {
      if (!eventId) throw new Error('Event ID is required');
      const response = await api.get(`/api/events/${eventId}`, { signal });
      if (!response.data.success) {
        throw new Error(response.data.message || 'Không thể tải thông tin sự kiện');
      }

      const parsed = eventDetailSchema.safeParse(response.data.data);
      if (!parsed.success) {
        const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
        throw new Error(`Dữ liệu chi tiết sự kiện không hợp lệ từ máy chủ: ${issues}`);
      }

      return parsed.data as EventDetail;
    },
    enabled: Boolean(eventId),
    staleTime: 1 * 60 * 1000,
  });
}

export function useMyTicketsQuery(page?: number, pageSize?: number, status?: string) {
  return useQuery<TicketItemData[]>({
    queryKey: ['tickets', 'my-tickets', { page, pageSize, status }],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (page) params.append('page', page.toString());
      if (pageSize) params.append('pageSize', pageSize.toString());
      if (status && status !== 'All') params.append('status', status);

      const url = params.toString() ? `/api/tickets/my-tickets?${params.toString()}` : '/api/tickets/my-tickets';
      const response = await api.get(url, { signal });
      if (!response.data.success) {
        throw new Error(response.data.message || 'Không thể tải danh sách vé');
      }

      const rawItems = Array.isArray(response.data.data)
        ? response.data.data
        : (response.data.data?.items ?? []);

      const parsed = ticketsResponseSchema.safeParse(rawItems);
      if (!parsed.success) {
        const issues = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
        throw new Error(`Dữ liệu danh sách vé không hợp lệ từ máy chủ: ${issues}`);
      }

      return parsed.data as unknown as TicketItemData[];
    },
    staleTime: 2 * 60 * 1000,
  });
}
