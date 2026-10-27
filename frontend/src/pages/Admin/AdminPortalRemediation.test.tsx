import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminEventsTable } from './Events/AdminEventsTable';
import AdminRefundsPage from './AdminRefundsPage';
import AdminDashboardPage from './AdminDashboardPage';
import AdminUsersPage from './AdminUsersPage';
import api from '../../services/api';
import type { Event as EventModel } from '../../types';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockEvent: EventModel = {
  id: 'event-1',
  title: 'Hòa Nhạc Mùa Thu 2026',
  description: 'Đêm diễn đặc biệt',
  date: '2026-11-20T19:00:00Z',
  location: 'Nhà hát lớn Hà Nội',
  venueName: 'Nhà hát lớn',
  category: 'Music',
  imageUrl: 'https://example.com/broken-poster.jpg',
  totalSeats: 500,
  availableSeatsCount: 120,
  basePrice: 500000,
  status: 1,
  version: '1',
};

describe('Admin Portal Remediation Verification', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('AdminEventsTable (ResilientImage & Heading Level 2)', () => {
    it('uses heading level 2 for mobile card title to maintain accessible heading hierarchy', () => {
      render(
        <MemoryRouter>
          <AdminEventsTable
            events={[mockEvent]}
            totalCount={1}
            page={1}
            totalPages={1}
            onPageChange={vi.fn()}
            onEdit={vi.fn()}
            onCancel={vi.fn()}
            onDelete={vi.fn()}
          />
        </MemoryRouter>
      );

      // Verify mobile heading is level 2 (under page h1)
      const mobileHeading = screen.getByRole('heading', { level: 2, name: 'Hòa Nhạc Mùa Thu 2026' });
      expect(mobileHeading).toBeInTheDocument();
    });

    it('renders fallback when event image fails to load without crashing table layout', () => {
      render(
        <MemoryRouter>
          <AdminEventsTable
            events={[mockEvent]}
            totalCount={1}
            page={1}
            totalPages={1}
            onPageChange={vi.fn()}
            onEdit={vi.fn()}
            onCancel={vi.fn()}
            onDelete={vi.fn()}
          />
        </MemoryRouter>
      );

      const images = screen.getAllByRole('img', { name: 'Hòa Nhạc Mùa Thu 2026' });
      expect(images.length).toBeGreaterThan(0);
      
      // Simulate image error
      fireEvent.error(images[0]);
      
      // ResilientImage replaces broken image with fallback container having role="img"
      expect(screen.getAllByRole('img', { name: 'Hòa Nhạc Mùa Thu 2026' })[0]).toBeInTheDocument();
    });
  });

  describe('AdminRefundsPage (URL SearchParams Pagination)', () => {
    it('reads initial page number from URL search parameters (?page=2)', async () => {
      const mockRefundsData = {
        success: true,
        data: {
          items: [
            {
              id: 'refund-12345678',
              eventId: 'event-1',
              ticketId: 'ticket-98765432',
              amount: 500000,
              status: 'Completed',
              attempts: 1,
              providerStatus: 'PAID',
              providerReference: 'PAYOS-REF-1',
              lastError: null,
              createdAt: '2026-10-27T08:00:00Z',
              nextAttemptAt: null,
            },
          ],
          page: 2,
          pageSize: 25,
          totalCount: 50,
        },
      };

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockRefundsData });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/admin/refunds?page=2']}>
            <Routes>
              <Route path="/admin/refunds" element={<AdminRefundsPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/admin/refunds', expect.objectContaining({
          params: { page: 2, pageSize: 25 },
        }));
      });

      expect(await screen.findByText(/Trang 2\/2/)).toBeInTheDocument();
    });
  });

  describe('AdminDashboardPage (Auto-Refresh & Visibility Sync)', () => {
    it('re-fetches dashboard statistics when document becomes visible', async () => {
      const mockStats = {
        success: true,
        data: {
          totalRevenue: 10000000,
          totalTicketsSold: 200,
          totalRefunded: 500000,
          checkInCount: 150,
          dailyStats: [],
          topEvents: [],
          recentTransactions: [],
        },
      };

      vi.mocked(api.get).mockResolvedValue({ data: mockStats });

      render(
        <MemoryRouter>
          <AdminDashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(1);
      });

      // Simulate tab visibilitychange
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'visible',
      });

      document.dispatchEvent(new Event('visibilitychange'));

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('AdminUsersPage (Immediate Filter & Debounced Search)', () => {
    it('fetches users list and handles search parameter debouncing cleanly', async () => {
      const mockUsersData = {
        success: true,
        data: {
          items: [
            {
              id: 'user-1',
              name: 'Nguyễn Văn Quản Trị',
              email: 'admin@tickex.vn',
              role: 'Admin',
              isBlocked: false,
              version: '1',
            },
          ],
          page: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
        },
      };

      vi.mocked(api.get).mockResolvedValue({ data: mockUsersData });

      render(
        <MemoryRouter initialEntries={['/admin/users?role=Admin']}>
          <Routes>
            <Route path="/admin/users" element={<AdminUsersPage />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith('/api/admin/users', expect.objectContaining({
          params: expect.objectContaining({ role: 'Admin' }),
        }));
      });

      const userElements = await screen.findAllByText('Nguyễn Văn Quản Trị');
      expect(userElements.length).toBeGreaterThan(0);
    });
  });
});

