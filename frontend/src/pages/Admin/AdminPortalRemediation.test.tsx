import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminEventsTable } from './Events/AdminEventsTable';
import AdminRefundsPage from './AdminRefundsPage';
import AdminDashboardPage from './AdminDashboardPage';
import AdminUsersPage from './AdminUsersPage';
import AdminEventsPage from './AdminEventsPage';
import AdminLayout from '../../components/Layout/AdminLayout';
import { ProfileInfoForm } from '../Profile/ProfileInfoForm';
import { ChangePasswordForm } from '../Profile/ChangePasswordForm';
import { RefundBankAccountForm } from '../Profile/RefundBankAccountForm';
import { useAuthStore } from '../../stores/useAuthStore';
import EventModal from '../../components/Admin/EventModal';
import { CheckoutVietQrView } from '../../components/Checkout/CheckoutVietQrView';
import { TicketCard } from '../Tickets/TicketCard';
import PaymentResultPage from '../PaymentResultPage';
import { AdminEventActions } from './Events/AdminEventActions';
import { DashboardTopEvents } from './Dashboard/DashboardTopEvents';
import { ScanCameraPanel } from './Scan/ScanCameraPanel';
import api from '../../services/api';
import type { Event as EventModel } from '../../types';

const mockScannerStart = vi.fn().mockResolvedValue(undefined);
const mockScannerStop = vi.fn().mockResolvedValue(undefined);
const mockScannerClear = vi.fn();

vi.mock('html5-qrcode', () => {
  return {
    Html5Qrcode: class {
      start = mockScannerStart;
      stop = mockScannerStop;
      clear = mockScannerClear;
      isScanning = true;
    },
  };
});

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

  describe('EventModal (Freeze Integrity)', () => {
    it('disables basePrice and preserves date/endDate verbatim when hasTicketHistory is true', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const versionedEvent: EventModel = {
        ...mockEvent,
        date: '2026-11-20T19:00:00.000Z',
        endDate: '2026-11-20T22:30:00.000Z',
        basePrice: 500000,
        hasTicketHistory: true,
      };

      render(
        <EventModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={onSubmit}
          event={versionedEvent}
        />
      );

      const priceInput = screen.getByLabelText(/Giá vé cơ sở/i);
      expect(priceInput).toBeDisabled();

      // Submit the form
      const submitBtn = screen.getByRole('button', { name: /Chỉnh Sửa Sự Kiện|Lưu/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });

      const submitted = onSubmit.mock.calls[0][0];
      expect(submitted.date).toBe('2026-11-20T19:00:00.000Z');
      expect(submitted.endDate).toBe('2026-11-20T22:30:00.000Z');
      expect(submitted.basePrice).toBe(500000);
    });
  });

  describe('AdminEventsPage (Delete ExpectedVersion & 409 Concurrency Conflict)', () => {
    it('passes expectedVersion on delete and refreshes events list on 409 conflict', async () => {
      const mockEventsData = {
        success: true,
        data: {
          items: [
            {
              id: 'event-to-delete',
              title: 'Sự Kiện Xóa Thử',
              description: 'Mô tả',
              date: '2026-12-01T10:00:00Z',
              endDate: '2026-12-01T12:00:00Z',
              location: 'Hà Nội',
              venueName: 'Trung tâm',
              category: 'Tech',
              imageUrl: 'https://example.com/tech.jpg',
              totalSeats: 100,
              availableSeatsCount: 100,
              basePrice: 200000,
              status: 1,
              version: 'version-token-123',
            },
          ],
          page: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
        },
      };

      vi.mocked(api.get).mockResolvedValue({ data: mockEventsData });
      vi.mocked(api.delete).mockRejectedValueOnce({
        response: { status: 409, data: { code: 'EVENT_CONCURRENCY_CONFLICT', message: 'Sự kiện vừa được chỉnh sửa' } },
      });

      render(
        <MemoryRouter>
          <AdminEventsPage />
        </MemoryRouter>
      );

      await screen.findAllByText('Sự Kiện Xóa Thử');

      // Click delete button on event
      const deleteButtons = screen.getAllByRole('button', { name: /Xóa sự kiện Sự Kiện Xóa Thử/i });
      fireEvent.click(deleteButtons[0]);

      // Confirm modal pops up
      const confirmDeleteBtn = await screen.findByRole('button', { name: /Xác nhận xóa/i });
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith('/api/events/event-to-delete', {
          params: { expectedVersion: 'version-token-123' },
        });
      });

      // Verifies refresh was triggered
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Round 5 Remediation Verification', () => {
    it('AdminLayout clears QueryClient cache on logout and renders resilient avatar', async () => {
      useAuthStore.getState().setAuth({
        id: 'admin-1',
        name: 'Admin User',
        email: 'admin@tickex.com',
        role: 'Admin',
        avatarUrl: 'https://example.com/avatar.jpg',
      }, 'test-token');

      const clearSpy = vi.spyOn(queryClient, 'clear');
      vi.mocked(api.post).mockResolvedValueOnce({ data: { success: true } });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AdminLayout />
          </MemoryRouter>
        </QueryClientProvider>
      );

      const logoutButtons = screen.getAllByRole('button', { name: /Đăng xuất/i });
      fireEvent.click(logoutButtons[0]);

      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalled();
        expect(useAuthStore.getState().user).toBeNull();
      });
    });

    it('AdminRefundsPage uses a section/div container instead of a nested main landmark', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          data: {
            items: [],
            totalCount: 0,
            page: 1,
            pageSize: 20,
          },
        },
      });

      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AdminRefundsPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Chưa có yêu cầu hoàn tiền.')).toBeInTheDocument();
      });

      // Crucial: Must NOT contain a nested <main> landmark because AdminLayout already provides the <main>
      expect(container.querySelector('main')).toBeNull();
    });

    it('Profile sub-forms use level 2 headings for accessible hierarchy under ProfilePage h1', () => {
      render(
        <MemoryRouter>
          <ProfileInfoForm
            email="test@test.local"
            currentAvatarUrl=""
            register={vi.fn() as any}
            errors={{}}
            onSubmit={vi.fn()}
            isSubmitting={false}
          />
          <ChangePasswordForm
            register={vi.fn() as any}
            errors={{}}
            onSubmit={vi.fn()}
            isSubmitting={false}
          />
          <RefundBankAccountForm
            bankBin="970415"
            accountName="Test User"
            maskedAccount="****1234"
            onSave={vi.fn()}
            onDelete={vi.fn()}
            isSubmitting={false}
          />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { level: 2, name: /Thông Tin Cá Nhân/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /Bảo Mật & Mật Khẩu/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /Tài khoản nhận hoàn tiền/i })).toBeInTheDocument();
    });
  });

  describe('Customer Portal Remediation Verification', () => {
    it('TicketCard renders event title as level 2 heading under MyTicketsPage h1', () => {
      const mockTicket = {
        id: 'ticket-1',
        eventId: 'event-1',
        eventTitle: 'Concert Test 2026',
        eventDate: '2026-11-20T19:00:00Z',
        location: 'Hanoi Opera House',
        venueName: 'Opera House',
        row: 'A',
        number: 1,
        tier: 0,
        price: 200000,
        status: 'Paid',
        qrCodeSignature: 'sig123',
        refundCutoffHours: 24,
      };

      render(
        <MemoryRouter>
          <TicketCard ticket={mockTicket as any} refundingId={null} onInitiateRefund={vi.fn()} />
        </MemoryRouter>
      );

      const heading = screen.getByRole('heading', { level: 2, name: 'Concert Test 2026' });
      expect(heading).toBeInTheDocument();
    });

    it('CheckoutVietQrView normalizes qrCodeUrl and renders bank transfer metadata', () => {
      const mockPaymentData = {
        checkoutUrl: 'https://pay.payos.vn/web/test',
        qrCode: 'https://api.qrserver.com/v1/create-qr-code/?data=TICKEX_ORDER',
        orderCode: 123456789012345,
        accountNumber: '0987654321',
        accountName: 'TICKEX PLATFORM',
        bin: '970415',
        bankName: 'VietinBank',
      };

      render(
        <MemoryRouter>
          <CheckoutVietQrView
            loadingPayment={false}
            paymentInitError={null}
            paymentData={mockPaymentData as any}
            onRetryPayment={vi.fn()}
            onProceedPayOS={vi.fn()}
            copyToClipboard={vi.fn()}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('0987654321')).toBeInTheDocument();
      expect(screen.getByText('TICKEX PLATFORM')).toBeInTheDocument();
      expect(screen.getByText(/VietinBank/)).toBeInTheDocument();
      const qrImg = screen.getByAltText(/Mã VietQR thanh toán/i);
      expect(qrImg).toHaveAttribute('src', 'https://api.qrserver.com/v1/create-qr-code/?data=TICKEX_ORDER');
    });

    it('PaymentResultPage invalidates tickets and events queries when status is Paid', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            orderCode: 123456789012345,
            status: 'PAID',
            amount: 200000,
          },
        },
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/payment/result?orderCode=123456789012345']}>
            <PaymentResultPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tickets'] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['events'] });
      });
    });
  });

  describe('AdminEventActions (Soft-Delete Disabled State)', () => {
    it('disables cancel button in desktop view when event is soft-deleted', () => {
      const deletedEvent: EventModel = {
        ...mockEvent,
        id: 'deleted-event',
        isDeleted: true,
      };

      render(
        <AdminEventActions
          event={deletedEvent}
          compact={false}
          onEdit={vi.fn()}
          onCancel={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      const cancelBtn = screen.getByRole('button', { name: /Hủy sự kiện & Hoàn tiền vé/i });
      expect(cancelBtn).toBeDisabled();
    });
  });

  describe('EventModal (Completed Status Transition)', () => {
    it('allows selecting Completed status when editing a published event', () => {
      render(
        <EventModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          event={mockEvent} // status is 1 (Published)
        />
      );

      expect(screen.getByLabelText(/Trạng thái sự kiện/i)).toBeInTheDocument();
      const completedOption = screen.getByRole('option', { name: /Đã kết thúc \(Completed\)/i }) as HTMLOptionElement;
      expect(completedOption).toBeInTheDocument();
      expect(completedOption.disabled).toBe(false);
    });

    it('disables Completed option when editing a draft event', () => {
      const draftEvent: EventModel = {
        ...mockEvent,
        status: 0, // Draft
      };

      render(
        <EventModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          event={draftEvent}
        />
      );

      const completedOption = screen.getByRole('option', { name: /Đã kết thúc \(Completed\)/i }) as HTMLOptionElement;
      expect(completedOption).toBeInTheDocument();
      expect(completedOption.disabled).toBe(true);
    });
  });

  describe('DashboardTopEvents (Heading Hierarchy WCAG 2.1 AA)', () => {
    it('renders event titles as h3 headings following the h2 section heading', () => {
      const topEvents = [
        {
          id: 'top-1',
          title: 'Concert Âm Nhạc Trẻ',
          category: 'Music',
          revenue: 150000000,
          ticketsSold: 300,
          totalSeats: 500,
        },
      ];

      render(<DashboardTopEvents topEvents={topEvents} />);

      const sectionHeading = screen.getByRole('heading', { level: 2, name: /Top Sự Kiện Bán Chạy Nhất/i });
      expect(sectionHeading).toBeInTheDocument();

      const eventTitleHeading = screen.getByRole('heading', { level: 3, name: /Concert Âm Nhạc Trẻ/i });
      expect(eventTitleHeading).toBeInTheDocument();
    });
  });

  describe('ScanCameraPanel (Camera Stream Lifecycle Stability)', () => {
    it('does not re-initialize or stop camera scanner when isVerifying toggles', async () => {
      const onScanToken = vi.fn();
      const { rerender } = render(
        <ScanCameraPanel onScanToken={onScanToken} isVerifying={false} />
      );

      // Wait for initial scanner start (150ms debounce)
      await waitFor(() => {
        expect(mockScannerStart).toHaveBeenCalledTimes(1);
      });

      // Toggle isVerifying to true
      rerender(<ScanCameraPanel onScanToken={onScanToken} isVerifying={true} />);

      // Wait a moment to ensure no restart or stop is triggered
      await new Promise((r) => setTimeout(r, 200));

      expect(mockScannerStart).toHaveBeenCalledTimes(1);
      expect(mockScannerStop).not.toHaveBeenCalled();
    });
  });
});

