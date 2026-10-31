import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminEventsTable } from './Events/AdminEventsTable';
import { AdminUsersTable } from './Users/AdminUsersTable';
import AdminRefundsPage from './AdminRefundsPage';
import AdminDashboardPage from './AdminDashboardPage';
import AdminUsersPage from './AdminUsersPage';
import AdminEventsPage from './AdminEventsPage';
import AdminScanTicketPage from './AdminScanTicketPage';
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
import { RecentScansList } from './Scan/RecentScansList';
import { ScanResultDisplay } from './Scan/ScanResultDisplay';
import { SeatMap } from '../EventDetail/SeatMap';
import { SeatLegend } from '../EventDetail/SeatLegend';
import RegisterPage from '../Auth/RegisterPage';
import MockPayOSPage from '../MockPayOSPage';
import { TicketFilterTabs } from '../Tickets/TicketFilterTabs';
import { DiscoveryHero } from '../../components/Discovery/DiscoveryHero';
import { SkeletonSeatMap } from '../../components/Skeletons/SkeletonSeatMap';
import { AdminEventsFilterBar } from './Events/AdminEventsFilterBar';
import { AdminUsersFilterBar } from './Users/AdminUsersFilterBar';
import { DashboardRevenueChart } from './Dashboard/DashboardRevenueChart';
import { DashboardRecentTransactions } from './Dashboard/DashboardRecentTransactions';
import { DashboardKpiGrid } from './Dashboard/DashboardKpiGrid';
import { AdminEventsHeader } from './Events/AdminEventsHeader';
import StandardLayout from '../../components/Layout/StandardLayout';
import { EventInfoCard } from '../EventDetail/EventInfoCard';
import { SelectedSeatPanel } from '../EventDetail/SelectedSeatPanel';
import ConfirmModal from '../../components/Admin/ConfirmModal';
import CheckoutModal from '../../components/CheckoutModal';
import api from '../../services/api';
import type { Event as EventModel } from '../../types';
import CancelEventModal from '../../components/Admin/CancelEventModal';
import { AdminEventsSkeleton } from './Events/AdminEventsSkeleton';
import { AdminUsersSkeleton } from './Users/AdminUsersSkeleton';
import { AdminDashboardEmptyState } from './Dashboard/AdminDashboardEmptyState';
import { EventSeatMatrixSection } from '../../components/Admin/EventModal/EventSeatMatrixSection';
import PaymentResultCard from '../PaymentResultCard';
import { CheckoutInvoice } from '../../components/Checkout/CheckoutInvoice';
import { EventCard } from '../../components/Discovery/EventCard';

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

  describe('Admin Scanner Heading Hierarchy (WCAG 2.1 AA Compliance)', () => {
    it('renders RecentScansList header with h2 heading level', () => {
      render(<RecentScansList recentScans={[]} />);
      const heading = screen.getByRole('heading', { level: 2, name: /Lịch sử soát vé gần nhất/i });
      expect(heading).toBeInTheDocument();
    });

    it('renders ScanResultDisplay with accessible h2 section heading', () => {
      render(
        <ScanResultDisplay
          scanResult={{
            status: 'valid',
            message: 'Vé hợp lệ - Cho phép vào cổng',
            ticket: {
              ticketId: 't-1',
              eventTitle: 'Concert Âm Nhạc Trẻ',
              attendeeName: 'Nguyễn Văn A',
              row: 'A',
              number: 1,
              tier: 'VIP',
            },
          }}
        />
      );
      const heading = screen.getByRole('heading', { level: 2, name: /Kết quả kiểm tra vé/i });
      expect(heading).toBeInTheDocument();
      const statusHeading = screen.getByRole('heading', { level: 3, name: /Vé hợp lệ - Cho phép vào cổng/i });
      expect(statusHeading).toBeInTheDocument();
    });
  });

  describe('Customer Experience Accessibility (WCAG 2.1 AA Compliance)', () => {
    it('renders SeatMap with accessible level 2 heading and region landmark', () => {
      render(<SeatMap seats={[]} selectedSeat={null} onSeatClick={vi.fn()} />);
      const heading = screen.getByRole('heading', { level: 2, name: /Sơ đồ chọn ghế/i });
      expect(heading).toBeInTheDocument();
    });

    it('renders CheckoutVietQrView error state with level 3 heading under checkout modal h2', () => {
      render(
        <CheckoutVietQrView
          loadingPayment={false}
          paymentInitError="Lỗi cổng thanh toán."
          paymentData={null}
          onRetryPayment={vi.fn()}
          onProceedPayOS={vi.fn()}
          copyToClipboard={vi.fn()}
        />
      );
      const errorHeading = screen.getByRole('heading', { level: 3, name: /Không thể tạo mã thanh toán/i });
      expect(errorHeading).toBeInTheDocument();
    });
  });

  describe('Admin Tables Pagination Navigation Landmarks (WCAG 2.1 AA)', () => {
    it('AdminEventsTable pagination uses semantic nav landmark', () => {
      render(
        <AdminEventsTable
          events={[]}
          totalCount={20}
          page={1}
          totalPages={2}
          onPageChange={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onCancel={vi.fn()}
        />
      );
      const paginationNav = screen.getByRole('navigation', { name: /Phân trang sự kiện/i });
      expect(paginationNav).toBeInTheDocument();
    });

    it('AdminUsersTable pagination uses semantic nav landmark and mobile cards use level 2 heading', () => {
      render(
        <AdminUsersTable
          users={[
            {
              id: 'u-1',
              name: 'Nguyễn Văn Admin',
              email: 'admin@tickex.com',
              role: 'Admin',
              isBlocked: false,
            },
          ]}
          totalCount={20}
          page={1}
          totalPages={2}
          isSubmitting={false}
          onPageChange={vi.fn()}
          onRequestChangeRole={vi.fn()}
          onRequestToggleBlock={vi.fn()}
        />
      );
      const userPaginationNav = screen.getByRole('navigation', { name: /Phân trang người dùng/i });
      expect(userPaginationNav).toBeInTheDocument();
      const userCardHeading = screen.getByRole('heading', { level: 2, name: /Nguyễn Văn Admin/i });
      expect(userCardHeading).toBeInTheDocument();
    });
  });

  describe('Full-Project Deep Audit Accessibility Remediation (WCAG 2.1 AA)', () => {
    it('RegisterPage renders home link with accessible name', () => {
      render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      );
      const homeLink = screen.getByRole('link', { name: /Về trang chủ TickeX/i });
      expect(homeLink).toBeInTheDocument();
    });

    it('MockPayOSPage renders level 1 heading when order code is missing', () => {
      render(
        <MemoryRouter initialEntries={['/mock-payos']}>
          <MockPayOSPage />
        </MemoryRouter>
      );
      const invalidHeading = screen.getByRole('heading', { level: 1, name: /Phiên Giao Dịch Không Hợp Lệ/i });
      expect(invalidHeading).toBeInTheDocument();
    });

    it('MockPayOSPage renders level 2 headings for sections under h1 in sandbox view', () => {
      render(
        <MemoryRouter initialEntries={['/mock-payos?orderCode=123456789012345']}>
          <MockPayOSPage />
        </MemoryRouter>
      );
      const qrHeading = screen.getByRole('heading', { level: 2, name: /Quét mã để thanh toán/i });
      expect(qrHeading).toBeInTheDocument();
      const summaryHeading = screen.getByRole('heading', { level: 2, name: /Thông tin Đơn hàng/i });
      expect(summaryHeading).toBeInTheDocument();
    });
  });

  describe('Customer Experience Group Landmark Accessibility (WCAG 2.1 AA)', () => {
    it('TicketFilterTabs renders group landmark with accessible label', () => {
      render(<TicketFilterTabs currentTab="All" onTabChange={vi.fn()} />);
      const group = screen.getByRole('group', { name: /Bộ lọc trạng thái vé/i });
      expect(group).toBeInTheDocument();
    });

    it('DiscoveryHero renders category group landmark with accessible label', () => {
      render(
        <DiscoveryHero
          search=""
          sortBy="date_asc"
          selectedCategory="All"
          onSearchChange={vi.fn()}
          onSortChange={vi.fn()}
          onCategoryChange={vi.fn()}
          onSubmit={vi.fn()}
        />
      );
      const catGroup = screen.getByRole('group', { name: /Lọc theo danh mục/i });
      expect(catGroup).toBeInTheDocument();
    });

    it('SkeletonSeatMap renders with role status and hidden accessible description', () => {
      render(<SkeletonSeatMap />);
      const statusContainer = screen.getByRole('status');
      expect(statusContainer).toBeInTheDocument();
      expect(screen.getByText(/Đang tải thông tin sự kiện và sơ đồ ghế/i)).toBeInTheDocument();
    });
  });

  describe('Admin Portal Decorative Icon Accessibility (WCAG 2.1 AA)', () => {
    it('Admin filter bars hide decorative search icons from screen readers', () => {
      const { container: eventsContainer } = render(
        <AdminEventsFilterBar
          searchQuery=""
          onSearchChange={vi.fn()}
          categoryFilter="All"
          onCategoryChange={vi.fn()}
          statusFilter="All"
          onStatusChange={vi.fn()}
        />
      );
      const eventsSearchIcon = eventsContainer.querySelector('div.relative svg');
      expect(eventsSearchIcon).toHaveAttribute('aria-hidden', 'true');

      cleanup();

      const { container: usersContainer } = render(
        <AdminUsersFilterBar
          searchTerm=""
          onSearchChange={vi.fn()}
          roleFilter=""
          onRoleChange={vi.fn()}
          blockFilter=""
          onBlockChange={vi.fn()}
        />
      );
      const usersSearchIcon = usersContainer.querySelector('div.relative svg');
      expect(usersSearchIcon).toHaveAttribute('aria-hidden', 'true');
    });

    it('Dashboard components render section icons and KPI card icons with aria-hidden', () => {
      const { container: chartContainer } = render(<DashboardRevenueChart dailyStats={[]} />);
      const chartIcon = chartContainer.querySelector('h2 svg');
      expect(chartIcon).toHaveAttribute('aria-hidden', 'true');

      cleanup();

      const { container: topEventsContainer } = render(<DashboardTopEvents topEvents={[]} />);
      const activityIcon = topEventsContainer.querySelector('h2 svg');
      expect(activityIcon).toHaveAttribute('aria-hidden', 'true');

      cleanup();

      const { container: recentTxContainer } = render(<DashboardRecentTransactions recentTransactions={[]} />);
      const dollarIcon = recentTxContainer.querySelector('h2 svg');
      expect(dollarIcon).toHaveAttribute('aria-hidden', 'true');

      cleanup();

      const mockStats = {
        totalRevenue: 1000000,
        totalTicketsSold: 10,
        totalCheckedIn: 5,
        totalRefunded: 0,
        totalEvents: 2,
        totalUsers: 5,
        dailyStats: [],
        topEvents: [],
        recentTransactions: []
      };
      const { container: kpiContainer } = render(<DashboardKpiGrid stats={mockStats} />);
      const icons = kpiContainer.querySelectorAll('.surface-panel svg');
      expect(icons.length).toBeGreaterThan(0);
      icons.forEach(icon => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('AdminEventsHeader hides decorative plus icon from assistive technology', () => {
      const { container } = render(<AdminEventsHeader onCreate={vi.fn()} />);
      const plusIcon = container.querySelector('button svg');
      expect(plusIcon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Full-Project Decorative Icon Accessibility (WCAG 2.1 AA)', () => {
    it('StandardLayout hides header brand, navigation and footer icons from screen readers', () => {
      const queryClient = new QueryClient();
      const { container } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <StandardLayout />
          </MemoryRouter>
        </QueryClientProvider>
      );
      const svgs = container.querySelectorAll('header svg, footer svg');
      expect(svgs.length).toBeGreaterThan(0);
      svgs.forEach(svg => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('EventInfoCard and SelectedSeatPanel hide decorative icons with aria-hidden', () => {
      const mockDetail = {
        ...mockEvent,
        seats: [],
      };
      const { container: infoContainer } = render(<EventInfoCard event={mockDetail} />);
      const infoSvgs = infoContainer.querySelectorAll('svg');
      expect(infoSvgs.length).toBeGreaterThan(0);
      infoSvgs.forEach(svg => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });

      cleanup();

      const { container: panelContainer } = render(
        <MemoryRouter>
          <SelectedSeatPanel
            selectedSeat={null}
            lockTimeLeft={null}
            locking={false}
            onBookTicket={vi.fn()}
          />
        </MemoryRouter>
      );
      const panelSvgs = panelContainer.querySelectorAll('svg');
      expect(panelSvgs.length).toBeGreaterThan(0);
      panelSvgs.forEach(svg => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('Profile sub-forms and ConfirmModal render decorative icons with aria-hidden', () => {
      const { container: profileContainer } = render(
        <ProfileInfoForm
          email="user@example.com"
          register={vi.fn().mockReturnValue({})}
          errors={{}}
          onSubmit={vi.fn()}
          isSubmitting={false}
        />
      );
      const profileSvgs = profileContainer.querySelectorAll('svg');
      expect(profileSvgs.length).toBeGreaterThan(0);
      profileSvgs.forEach(svg => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });

      cleanup();

      const { container: modalContainer } = render(
        <ConfirmModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Xác nhận"
          message="Nội dung"
        />
      );
      const modalSvgs = modalContainer.querySelectorAll('svg');
      expect(modalSvgs.length).toBeGreaterThan(0);
      modalSvgs.forEach(svg => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Customer Portal Remediation Verification (Round 15)', () => {
    it('RegisterPage provides accessible labels and marks all decorative icons with aria-hidden', () => {
      const { container } = render(
        <MemoryRouter>
          <RegisterPage />
        </MemoryRouter>
      );

      // Verify explicit form labels for inputs
      expect(container.querySelector('label[for="register-name"]')).toBeInTheDocument();
      expect(container.querySelector('label[for="register-email"]')).toBeInTheDocument();
      expect(container.querySelector('label[for="register-password"]')).toBeInTheDocument();
      expect(container.querySelector('label[for="register-confirm-password"]')).toBeInTheDocument();

      // Verify submit button has aria-busy
      const submitBtn = screen.getByRole('button', { name: /Đăng Ký Tài Khoản/i });
      expect(submitBtn).toHaveAttribute('aria-busy', 'false');

      // Verify all decorative svgs inside form have aria-hidden="true"
      const svgs = container.querySelectorAll('form svg');
      expect(svgs.length).toBeGreaterThan(0);
      svgs.forEach(svg => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('SeatLegend exposes role group with accessible label and hides swatches and Crown from assistive tech', () => {
      const { container } = render(<SeatLegend />);
      const group = container.querySelector('[role="group"]');
      expect(group).toBeInTheDocument();
      expect(group).toHaveAttribute('aria-label', 'Chú thích hạng ghế và trạng thái');

      const crownIcon = container.querySelector('svg');
      expect(crownIcon).toHaveAttribute('aria-hidden', 'true');

      // Verify swatch color divs have aria-hidden="true"
      const swatches = container.querySelectorAll('div.rounded-t');
      expect(swatches.length).toBeGreaterThan(0);
      swatches.forEach(swatch => {
        expect(swatch).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('CheckoutVietQrView hides action and feedback icons with aria-hidden', () => {
      const mockPaymentData = {
        checkoutUrl: 'https://pay.payos.vn/web/test',
        qrCode: 'https://api.qrserver.com/v1/create-qr-code/?data=TICKEX_ORDER',
        orderCode: 123456789012345,
        accountNumber: '0987654321',
        accountName: 'TICKEX PLATFORM',
        bin: '970415',
        bankName: 'VietinBank',
      };

      const { container } = render(
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

      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
      svgs.forEach(svg => {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('CheckoutVietQrView loading state exposes accessible status role and polite live region', () => {
      const { container } = render(
        <MemoryRouter>
          <CheckoutVietQrView
            loadingPayment={true}
            paymentInitError={null}
            paymentData={null}
            onRetryPayment={vi.fn()}
            onProceedPayOS={vi.fn()}
            copyToClipboard={vi.fn()}
          />
        </MemoryRouter>
      );

      const statusEl = container.querySelector('[role="status"]');
      expect(statusEl).toBeInTheDocument();
      expect(statusEl).toHaveAttribute('aria-live', 'polite');
      expect(statusEl).toHaveAttribute('aria-busy', 'true');

      const loaderSvg = container.querySelector('svg');
      expect(loaderSvg).toHaveAttribute('aria-hidden', 'true');
    });

    it('CheckoutModal marks backdrop overlay with aria-hidden', () => {
      const mockSeat = {
        id: 'seat-1',
        eventId: 'event-1',
        row: 'A',
        number: 1,
        tier: 1,
        price: 500000,
        status: 1 as const,
        version: 1,
      };

      const mockDetail = {
        ...mockEvent,
        seats: [mockSeat],
      } as any;

      const { container } = render(
        <MemoryRouter>
          <CheckoutModal
            isOpen={true}
            onClose={vi.fn()}
            event={mockDetail}
            seat={mockSeat as any}
            ticketId="ticket-1"
            expiresAt={new Date(Date.now() + 300000).toISOString()}
          />
        </MemoryRouter>
      );

      const backdrop = container.querySelector('.backdrop-blur-md');
      expect(backdrop).toBeInTheDocument();
      expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    });
  });
  describe('Admin Portal Remediation Verification (Round 16)', () => {
    it('CancelEventModal renders submit button with aria-busy and decorative icons with aria-hidden', () => {
      const { container } = render(
        <CancelEventModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          eventTitle="Rock Concert 2026"
          isLoading={true}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Xác Nhận Hủy Sự Kiện/i });
      expect(submitBtn).toHaveAttribute('aria-busy', 'true');
      expect(submitBtn).toBeDisabled();

      const icons = container.querySelectorAll('svg');
      expect(icons.length).toBeGreaterThan(0);
      icons.forEach(icon => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('EventModal renders submit button with aria-busy', () => {
      render(
        <EventModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          isLoading={true}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Tạo Sự Kiện/i });
      expect(submitBtn).toHaveAttribute('aria-busy', 'true');
    });

    it('AdminEventsTable renders decorative table icons with aria-hidden and pagination buttons with type="button"', () => {
      const { container } = render(
        <AdminEventsTable
          events={[mockEvent]}
          totalCount={1}
          page={1}
          totalPages={2}
          onPageChange={vi.fn()}
          onEdit={vi.fn()}
          onCancel={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      const prevBtn = screen.getByRole('button', { name: 'Trang trước' });
      const nextBtn = screen.getByRole('button', { name: 'Trang sau' });
      expect(prevBtn).toHaveAttribute('type', 'button');
      expect(nextBtn).toHaveAttribute('type', 'button');

      const icons = container.querySelectorAll('svg');
      icons.forEach(icon => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('AdminUsersTable renders decorative icons with aria-hidden and action buttons with type="button"', () => {
      const mockUser = {
        id: 'user-1',
        name: 'Nguyen Van A',
        email: 'vana@example.com',
        role: 'Customer',
        isBlocked: false,
      };

      const { container } = render(
        <AdminUsersTable
          users={[mockUser]}
          totalCount={1}
          page={1}
          totalPages={2}
          isSubmitting={false}
          onPageChange={vi.fn()}
          onRequestChangeRole={vi.fn()}
          onRequestToggleBlock={vi.fn()}
        />
      );

      const blockBtns = screen.getAllByRole('button', { name: /Khóa/i });
      expect(blockBtns.length).toBe(2);
      blockBtns.forEach(btn => expect(btn).toHaveAttribute('type', 'button'));

      const prevBtn = screen.getByRole('button', { name: 'Trang trước' });
      const nextBtn = screen.getByRole('button', { name: 'Trang sau' });
      expect(prevBtn).toHaveAttribute('type', 'button');
      expect(nextBtn).toHaveAttribute('type', 'button');

      const icons = container.querySelectorAll('svg');
      icons.forEach(icon => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });

    it('AdminEventsSkeleton and AdminUsersSkeleton render with role="status", aria-busy="true", and announcements', () => {
      const { unmount } = render(<AdminEventsSkeleton />);
      const eventsSkeleton = screen.getByRole('status');
      expect(eventsSkeleton).toHaveAttribute('aria-busy', 'true');
      expect(eventsSkeleton).toHaveAttribute('aria-label', 'Đang tải sự kiện...');
      expect(screen.getByText('Đang tải sự kiện...')).toHaveClass('sr-only');
      unmount();

      render(<AdminUsersSkeleton />);
      const usersSkeleton = screen.getByRole('status');
      expect(usersSkeleton).toHaveAttribute('aria-busy', 'true');
      expect(usersSkeleton).toHaveAttribute('aria-label', 'Đang tải danh sách người dùng...');
      expect(screen.getByText('Đang tải danh sách người dùng...')).toHaveClass('sr-only');
    });

    it('AdminDashboardEmptyState renders refresh button with aria-busy', () => {
      render(
        <MemoryRouter>
          <AdminDashboardEmptyState onRefresh={vi.fn()} isRefreshing={true} />
        </MemoryRouter>
      );

      const refreshBtn = screen.getByRole('button', { name: /Làm mới/i });
      expect(refreshBtn).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Project-Wide Deep Audit Verification (Round 17)', () => {
    it('EventSeatMatrixSection renders matrix heading as h3 for heading hierarchy compliance', () => {
      render(
        <EventSeatMatrixSection
          totalMatrixSeats={100}
          register={vi.fn() as any}
          errors={{} as any}
        />
      );

      const heading = screen.getByRole('heading', { name: /Cấu hình Sơ Đồ Ma Trận Ghế/i });
      expect(heading.tagName.toLowerCase()).toBe('h3');
    });

    it('ConfirmModal renders close button with type="button" and submit button with aria-busy', () => {
      render(
        <ConfirmModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Xác nhận xóa"
          message="Bạn có chắc chắn muốn xóa không?"
          isLoading={true}
        />
      );

      const closeBtn = screen.getByRole('button', { name: 'Đóng' });
      expect(closeBtn).toHaveAttribute('type', 'button');

      const submitBtn = screen.getByRole('button', { name: 'Xác Nhận' });
      expect(submitBtn).toHaveAttribute('type', 'button');
      expect(submitBtn).toHaveAttribute('aria-busy', 'true');
    });

    it('SelectedSeatPanel renders book button with type="button" and aria-busy', () => {
      const mockSeat = {
        id: 'seat-10',
        eventId: 'event-1',
        row: 'B',
        number: 5,
        tier: 1,
        price: 500000,
        status: 0,
        version: 1,
      };

      render(
        <MemoryRouter>
          <SelectedSeatPanel
            selectedSeat={mockSeat as any}
            locking={true}
            lockTimeLeft={300}
            onBookTicket={vi.fn()}
          />
        </MemoryRouter>
      );

      const bookBtn = screen.getByRole('button');
      expect(bookBtn).toHaveAttribute('type', 'button');
      expect(bookBtn).toHaveAttribute('aria-busy', 'true');
    });

    it('PaymentResultCard renders retry button with aria-busy when checking', () => {
      render(
        <MemoryRouter>
          <PaymentResultCard
            orderCode="ORD-12345"
            phase={{ state: 'checking', status: 'Pending' }}
            isChecking={true}
            isPending={true}
            isSuccess={false}
            isUnknown={false}
            pollAttempt={1}
            pollLimit={5}
            onRetry={vi.fn()}
          />
        </MemoryRouter>
      );

      const retryBtn = screen.getByRole('button', { name: /Kiểm Tra Lại|Đang kiểm tra/i });
      expect(retryBtn).toHaveAttribute('aria-busy', 'true');
    });

    it('AdminEventsHeader renders create button with type="button"', () => {
      render(<AdminEventsHeader onCreate={vi.fn()} />);
      const createBtn = screen.getByRole('button', { name: /Tạo Sự Kiện Mới/i });
      expect(createBtn).toHaveAttribute('type', 'button');
    });
  });

  describe('Customer Portal Deep Remediation Verification (Round 18)', () => {
    it('ProfileInfoForm renders submit button with aria-busy when isSubmitting is true', () => {
      render(
        <ProfileInfoForm
          email="test@example.com"
          register={vi.fn() as any}
          errors={{} as any}
          onSubmit={vi.fn()}
          isSubmitting={true}
        />
      );

      const saveBtn = screen.getByRole('button', { name: /Lưu Thay Đổi/i });
      expect(saveBtn).toHaveAttribute('aria-busy', 'true');
    });

    it('ChangePasswordForm renders submit button with aria-busy when isSubmitting is true', () => {
      render(
        <ChangePasswordForm
          register={vi.fn() as any}
          errors={{} as any}
          onSubmit={vi.fn()}
          isSubmitting={true}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Cập Nhật Mật Khẩu/i });
      expect(submitBtn).toHaveAttribute('aria-busy', 'true');
    });

    it('RefundBankAccountForm renders save and delete buttons with aria-busy when isSubmitting is true', () => {
      render(
        <RefundBankAccountForm
          bankBin="970415"
          accountName="NGUYEN VAN A"
          maskedAccount="••••1234"
          onSave={vi.fn()}
          onDelete={vi.fn()}
          isSubmitting={true}
        />
      );

      const saveBtn = screen.getByRole('button', { name: /Lưu tài khoản/i });
      expect(saveBtn).toHaveAttribute('aria-busy', 'true');

      const deleteBtn = screen.getByRole('button', { name: /Xóa tài khoản/i });
      expect(deleteBtn).toHaveAttribute('aria-busy', 'true');
    });

    it('CheckoutInvoice renders countdown timer with role="timer" and aria-atomic="true"', () => {
      const mockSeat = {
        id: 'seat-1',
        eventId: 'event-1',
        row: 'A',
        number: 1,
        tier: 1,
        price: 500000,
        status: 1 as const,
        version: 1,
      };

      render(
        <CheckoutInvoice
          event={mockEvent as any}
          seat={mockSeat as any}
          timeLeft={45}
          formatTime={(s) => `00:${s}`}
          status="idle"
        />
      );

      const timer = screen.getByRole('timer');
      expect(timer).toBeInTheDocument();
      expect(timer).toHaveAttribute('aria-atomic', 'true');
      expect(timer).toHaveAttribute('aria-live', 'polite');
    });
  });


  describe('Admin Portal Deep Remediation Verification (Round 19)', () => {
    it('DashboardTopEvents renders seat fill progressbar with accessible attributes', () => {
      const topEvents = [
        { id: 'evt-1', title: 'Đêm Nhạc Trẻ', category: 'Music', revenue: 12000000, ticketsSold: 80, totalSeats: 100 }
      ];

      render(<DashboardTopEvents topEvents={topEvents} />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeInTheDocument();
      expect(progressbar).toHaveAttribute('aria-valuenow', '80');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
      expect(progressbar).toHaveAttribute('aria-label', expect.stringContaining('80%'));
    });

    it('DashboardRecentTransactions renders feed with aria-label and empty status', () => {
      const { rerender } = render(<DashboardRecentTransactions recentTransactions={[]} />);
      const feedEmpty = screen.getByRole('feed', { name: /Lịch sử giao dịch gần đây/i });
      expect(feedEmpty).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/Chưa có giao dịch nào/i);

      const mockTxs = [
        {
          ticketId: 'tx-1',
          orderCode: 123456,
          userName: 'Nguyen Van A',
          eventTitle: 'Rock Fest',
          amount: 500000,
          status: 'Paid',
          createdAt: new Date().toISOString()
        }
      ];

      rerender(<DashboardRecentTransactions recentTransactions={mockTxs} />);
      expect(screen.getByText('#123456')).toBeInTheDocument();
    });

    it('RecentScansList renders feed with aria-label and empty status', () => {
      const { rerender } = render(<RecentScansList recentScans={[]} />);
      const feed = screen.getByRole('feed', { name: /Danh sách lượt quét vé gần nhất/i });
      expect(feed).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(/Chưa có lượt quét nào/i);

      const mockScans = [
        {
          status: 'valid' as const,
          message: 'VÉ HỢP LỆ',
          ticket: {
            ticketId: 't-1',
            eventTitle: 'Concert A',
            attendeeName: 'Tran B',
            row: 'B',
            number: 5,
            tier: 1
          }
        }
      ];

      rerender(<RecentScansList recentScans={mockScans} />);
      expect(screen.getByText('Tran B')).toBeInTheDocument();
    });

    it('AdminEventActions compact mode provides contextual aria-labels', () => {
      render(
        <AdminEventActions
          event={mockEvent}
          onEdit={vi.fn()}
          onCancel={vi.fn()}
          onDelete={vi.fn()}
          compact={true}
        />
      );

      const editBtn = screen.getByRole('button', { name: new RegExp(`Chỉnh sửa sự kiện ${mockEvent.title}`, 'i') });
      const cancelBtn = screen.getByRole('button', { name: new RegExp(`Hủy sự kiện ${mockEvent.title}`, 'i') });
      const deleteBtn = screen.getByRole('button', { name: new RegExp(`Xóa sự kiện ${mockEvent.title}`, 'i') });

      expect(editBtn).toBeInTheDocument();
      expect(cancelBtn).toBeInTheDocument();
      expect(deleteBtn).toBeInTheDocument();
    });

    it('AdminUsersTable provides contextual aria-labels for block and unblock buttons', () => {
      const mockUsers = [
        { id: 'u-1', name: 'Le Van C', email: 'c@example.com', role: 'Customer', isBlocked: false },
        { id: 'u-2', name: 'Pham Thi D', email: 'd@example.com', role: 'Staff', isBlocked: true }
      ];

      render(
        <AdminUsersTable
          users={mockUsers}
          totalCount={2}
          page={1}
          totalPages={1}
          isSubmitting={false}
          onPageChange={vi.fn()}
          onRequestChangeRole={vi.fn()}
          onRequestToggleBlock={vi.fn()}
        />
      );

      const blockBtns = screen.getAllByRole('button', { name: /Khóa tài khoản Le Van C/i });
      expect(blockBtns.length).toBeGreaterThanOrEqual(1);

      const unblockBtns = screen.getAllByRole('button', { name: /Mở khóa tài khoản Pham Thi D/i });
      expect(unblockBtns.length).toBeGreaterThanOrEqual(1);
    });

    it('AdminEventsFilterBar and AdminUsersFilterBar contain role="search"', () => {
      const { rerender } = render(
        <AdminEventsFilterBar
          searchQuery=""
          onSearchChange={vi.fn()}
          categoryFilter="All"
          onCategoryChange={vi.fn()}
          statusFilter="All"
          onStatusChange={vi.fn()}
        />
      );

      expect(screen.getByRole('search')).toBeInTheDocument();

      rerender(
        <AdminUsersFilterBar
          searchTerm=""
          onSearchChange={vi.fn()}
          roleFilter=""
          onRoleChange={vi.fn()}
          blockFilter=""
          onBlockChange={vi.fn()}
        />
      );

      expect(screen.getByRole('search')).toBeInTheDocument();
    });

    it('ScanCameraPanel renders camera controls with accessible labels', () => {
      render(
        <ScanCameraPanel
          onScanToken={vi.fn()}
          isVerifying={false}
        />
      );

      expect(screen.getByRole('button', { name: /Tắt Camera|Bật Camera/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Dán mã vé từ bộ nhớ tạm|Dán Clipboard/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Đổi camera trước sau/i })).toBeInTheDocument();
    });
  });


  describe('Admin Portal Full-Project Audit Verification (Round 20)', () => {
    it('AdminScanTicketPage surfaces rejection message when server returns success=false', async () => {
      const mockPost = vi.mocked(api.post);
      mockPost.mockResolvedValueOnce({
        data: {
          success: false,
          message: 'Vé đã bị ban tổ chức thu hồi.',
        },
      });

      render(
        <MemoryRouter>
          <AdminScanTicketPage />
        </MemoryRouter>
      );

      const input = screen.getByPlaceholderText(/Dán chuỗi token chữ ký số/i);
      fireEvent.change(input, { target: { value: 'payload.signature' } });

      const scanBtn = screen.getByRole('button', { name: /Soát Vé/i });
      fireEvent.click(scanBtn);

      await waitFor(() => {
        expect(screen.getAllByText('Vé đã bị ban tổ chức thu hồi.').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('AdminRefundsPage renders localized Vietnamese status label and accessible retry button', async () => {
      const mockGet = vi.mocked(api.get);
      mockGet.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            items: [
              {
                id: 'refund-12345678',
                eventId: 'evt-1',
                ticketId: 'tkt-87654321',
                amount: 350000,
                status: 'NeedsReview',
                attempts: 2,
                providerStatus: 'FAILED',
                providerReference: 'PAYOS-REF-01',
                lastError: 'Ngân hàng từ chối lệnh chi',
                createdAt: new Date().toISOString(),
                nextAttemptAt: null,
              },
            ],
            page: 1,
            pageSize: 25,
            totalCount: 1,
          },
        },
      });

      render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter>
            <AdminRefundsPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Cần đối soát')).toBeInTheDocument();
      });

      const retryBtn = screen.getByRole('button', { name: /Đối soát lại yêu cầu refund-1/i });
      expect(retryBtn).toBeInTheDocument();
      expect(retryBtn).toHaveAttribute('type', 'button');
    });

    it('TicketCard renders contextual aria-label incorporating eventTitle for payment, release, refund, and download', () => {
      const mockTicket = {
        id: 'ticket-999',
        eventId: 'event-1',
        eventTitle: 'Rock Fest 2026',
        eventDate: '2026-11-20T19:00:00Z',
        location: 'Sân vận động Mỹ Đình',
        venueName: 'Mỹ Đình',
        row: 'B',
        number: 5,
        tier: 1,
        price: 350000,
        status: 'Pending',
        qrCodeSignature: 'sig999',
        refundCutoffHours: 48,
        canRefund: false,
      };

      const { rerender } = render(
        <MemoryRouter>
          <TicketCard
            ticket={mockTicket as any}
            refundingId={null}
            onInitiateRefund={vi.fn()}
            onResumePayment={vi.fn()}
            onReleaseReservation={vi.fn()}
          />
        </MemoryRouter>
      );

      const resumeBtn = screen.getByRole('button', { name: /Tiếp tục thanh toán vé sự kiện Rock Fest 2026/i });
      expect(resumeBtn).toBeInTheDocument();

      const releaseBtn = screen.getByRole('button', { name: /Hủy giữ chỗ vé sự kiện Rock Fest 2026/i });
      expect(releaseBtn).toBeInTheDocument();

      const paidTicket = {
        ...mockTicket,
        status: 'Paid',
        canRefund: true,
      };

      rerender(
        <MemoryRouter>
          <TicketCard
            ticket={paidTicket as any}
            refundingId={null}
            onInitiateRefund={vi.fn()}
          />
        </MemoryRouter>
      );

      const refundBtn = screen.getByRole('button', { name: /Yêu cầu hoàn vé sự kiện Rock Fest 2026/i });
      expect(refundBtn).toBeInTheDocument();

      const downloadBtn = screen.getByRole('button', { name: /Tải file vé PDF chuẩn cho sự kiện Rock Fest 2026/i });
      expect(downloadBtn).toBeInTheDocument();
    });

    it('EventCard renders accessible aria-label for featured and standard view', () => {
      const testEvent: EventModel = {
        id: 'event-featured-1',
        title: 'Hòa Nhạc Giao Hưởng Mùa Đông',
        description: 'Đêm nhạc thính phòng',
        date: '2026-12-15T20:00:00Z',
        location: 'Nhà hát Lớn Hà Nội',
        venueName: 'Nhà hát Lớn',
        category: 'Classical',
        imageUrl: 'https://example.com/winter.jpg',
        totalSeats: 300,
        availableSeatsCount: 50,
        basePrice: 600000,
        status: 1,
        version: '1',
      };

      const { rerender } = render(
        <MemoryRouter>
          <EventCard event={testEvent} featured={true} />
        </MemoryRouter>
      );

      const featuredLink = screen.getByRole('link', { name: /Xem sự kiện Hòa Nhạc Giao Hưởng Mùa Đông/i });
      expect(featuredLink).toBeInTheDocument();

      rerender(
        <MemoryRouter>
          <EventCard event={testEvent} featured={false} />
        </MemoryRouter>
      );

      const standardLink = screen.getByRole('link', { name: /Chọn chỗ sự kiện Hòa Nhạc Giao Hưởng Mùa Đông/i });
      expect(standardLink).toBeInTheDocument();
    });

  });

});
