import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import api from '../services/api';
import { Event, EventDetail } from '../types';
import { TicketItemData } from '../pages/Tickets/TicketCard';

const catalogResponseSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())).default([]),
  totalPages: z.number().default(1),
  totalCount: z.number().default(0),
}).passthrough();

const eventDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.string(),
  venue: z.string(),
  price: z.number(),
  totalSeats: z.number(),
  availableSeats: z.number(),
  status: z.string(),
}).passthrough();

const ticketItemSchema = z.object({
  id: z.string(),
  orderCode: z.number(),
  price: z.number(),
  status: z.string(),
  eventId: z.string(),
  eventName: z.string(),
  eventDate: z.string(),
  seatCode: z.string(),
}).passthrough();

const ticketsResponseSchema = z.array(ticketItemSchema);

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
      const data = parsed.success ? parsed.data : response.data.data;

      return {
        items: (data?.items || []) as unknown as Event[],
        totalPages: data?.totalPages ?? 1,
        totalCount: data?.totalCount ?? 0,
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
      return (parsed.success ? parsed.data : response.data.data) as EventDetail;
    },
    enabled: Boolean(eventId),
    staleTime: 1 * 60 * 1000,
  });
}

export function useMyTicketsQuery(page?: number, pageSize?: number) {
  return useQuery<TicketItemData[]>({
    queryKey: ['tickets', 'my-tickets', { page, pageSize }],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (page) params.append('page', page.toString());
      if (pageSize) params.append('pageSize', pageSize.toString());

      const url = params.toString() ? `/api/tickets/my-tickets?${params.toString()}` : '/api/tickets/my-tickets';
      const response = await api.get(url, { signal });
      if (!response.data.success) {
        throw new Error(response.data.message || 'Không thể tải danh sách vé');
      }

      const parsed = ticketsResponseSchema.safeParse(response.data.data);
      return (parsed.success ? parsed.data : response.data.data || []) as TicketItemData[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

