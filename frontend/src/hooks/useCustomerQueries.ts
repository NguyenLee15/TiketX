import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Event, EventDetail } from '../types';
import { TicketItemData } from '../pages/Tickets/TicketCard';

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

      return {
        items: response.data.data.items || [],
        totalPages: response.data.data.totalPages || 1,
        totalCount: response.data.data.totalCount || 0,
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
      return response.data.data;
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
      return response.data.data || [];
    },
    staleTime: 2 * 60 * 1000,
  });
}

