import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import api from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { Event, EventDetail } from '../types';
import { TicketItemData } from '../pages/Tickets/TicketCard';

export const eventItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  date: z.string().min(1),
  endDate: z.string().optional().nullable(),
  location: z.string().default(''),
  venueName: z.string().optional().default(''),
  category: z.string().default(''),
  imageUrl: z.string().default(''),
  bannerUrl: z.string().optional().default(''),
  organizerName: z.string().optional().default(''),
  totalSeats: z.number().int().nonnegative(),
  availableSeatsCount: z.number().int().nonnegative().optional().default(0),
  basePrice: z.number().nonnegative(),
  minPrice: z.number().nonnegative().optional().default(0),
  maxPrice: z.number().nonnegative().optional().default(0),
  status: z.union([z.number(), z.string()]),
  refundCutoffHours: z.number().int().nonnegative().optional().default(24),
  isDeleted: z.boolean().optional().default(false),
  hasTicketHistory: z.boolean().optional().default(false),
}).passthrough();

export const catalogResponseSchema = z.object({
  items: z.array(eventItemSchema),
  totalPages: z.number().int(),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().optional().default(10),
}).passthrough();

export const seatSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  row: z.string().min(1),
  number: z.number().int().positive(),
  tier: z.union([z.number(), z.string()]).transform((v, ctx) => {
    if (typeof v === 'number' && (v === 0 || v === 1 || v === 2)) return v;
    if (typeof v === 'string') {
      const lower = v.toLowerCase();
      if (lower === 'standard' || lower === '0') return 0;
      if (lower === 'vip' || lower === '1') return 1;
      if (lower === 'economy' || lower === '2') return 2;
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid seat tier: ${v}`,
    });
    return z.NEVER;
  }),
  status: z.union([z.number(), z.string()]).transform((v, ctx) => {
    if (typeof v === 'number' && (v === 0 || v === 1 || v === 2)) return v;
    if (typeof v === 'string') {
      const lower = v.toLowerCase();
      if (lower === 'available' || lower === '0') return 0;
      if (lower === 'locked' || lower === '1') return 1;
      if (lower === 'sold' || lower === '2') return 2;
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid seat status: ${v}`,
    });
    return z.NEVER;
  }),
  price: z.number().nonnegative(),
  version: z.string(),
  isLockedByCurrentUser: z.boolean().optional().default(false),
}).passthrough();

export const eventDetailSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().default(''),
  date: z.string().min(1),
  endDate: z.string().optional().nullable(),
  location: z.string().default(''),
  venueName: z.string().optional().default(''),
  category: z.string().default(''),
  imageUrl: z.string().default(''),
  bannerUrl: z.string().optional().default(''),
  organizerName: z.string().optional().default(''),
  totalSeats: z.number().int().nonnegative(),
  availableSeatsCount: z.number().int().nonnegative().optional().default(0),
  basePrice: z.number().nonnegative(),
  minPrice: z.number().nonnegative().optional().default(0),
  maxPrice: z.number().nonnegative().optional().default(0),
  status: z.union([z.number(), z.string()]),
  refundCutoffHours: z.number().int().nonnegative().optional().default(24),
  seats: z.array(seatSchema),
}).passthrough();

export const ticketItemSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  seatId: z.string().min(1),
  eventTitle: z.string().min(1),
  eventDescription: z.string().optional().default(''),
  eventDate: z.string().min(1),
  endDate: z.string().optional().default(''),
  location: z.string().default(''),
  venueName: z.string().optional().default(''),
  category: z.string().optional().default(''),
  imageUrl: z.string().optional().default(''),
  row: z.string().min(1),
  number: z.number().int().positive(),
  tier: z.union([z.number(), z.string()]).transform((v, ctx) => {
    if (typeof v === 'number' && (v === 0 || v === 1 || v === 2)) return v;
    if (typeof v === 'string') {
      const lower = v.toLowerCase();
      if (lower === 'standard' || lower === '0') return 0;
      if (lower === 'vip' || lower === '1') return 1;
      if (lower === 'economy' || lower === '2') return 2;
    }
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid seat tier: ${v}`,
    });
    return z.NEVER;
  }),
  price: z.number().nonnegative(),
  status: z.string().min(1),
  refundStatus: z.string().optional().nullable(),
  orderCode: z.union([z.string().min(1), z.number()]).transform(v => String(v)),
  qrCodeSignature: z.string().optional().default(''),
  paidAt: z.string().optional().nullable(),
  checkedInAt: z.string().optional().nullable(),
  refundAmount: z.number().optional().nullable(),
  refundedAt: z.string().optional().nullable(),
  refundCutoffHours: z.number().int().nonnegative().optional().default(24),
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
  const user = useAuthStore(state => state.user);
  const userId = user?.id ?? '';

  return useQuery<TicketItemData[]>({
    queryKey: ['tickets', 'my-tickets', userId, { page, pageSize, status }],
    enabled: Boolean(userId),
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

      const rawData = response.data?.data;
      if (!rawData) {
        throw new Error('Dữ liệu danh sách vé rỗng hoặc không hợp lệ từ máy chủ');
      }

      const rawItems = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.items)
          ? rawData.items
          : null;

      if (!rawItems) {
        throw new Error('Định dạng danh sách vé từ máy chủ không hợp lệ');
      }

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
