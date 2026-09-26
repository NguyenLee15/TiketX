import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ticket, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { TicketCard, TicketItemData } from './TicketCard';
import { TicketFilterTabs, allowedTicketTabs, TicketTabType } from './TicketFilterTabs';
import { TicketRefundModal } from './TicketRefundModal';
import { TicketPagination } from './TicketPagination';
import { useMyTicketsQuery } from '../../hooks/useCustomerQueries';

const PAGE_SIZE = 10;

export default function MyTicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundCandidate, setRefundCandidate] = useState<TicketItemData | null>(null);

  // Single Source of Truth from URL params (Zero derived effect ping-pong loops)
  const requestedTab = searchParams.get('status');
  const filterTab: TicketTabType = allowedTicketTabs.includes(requestedTab as TicketTabType) 
    ? (requestedTab as TicketTabType) 
    : 'All';

  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const {
    data: ticketPage,
    isLoading,
    isError: loadError,
    refetch: refetchTickets,
  } = useMyTicketsQuery(currentPage, PAGE_SIZE, filterTab === 'All' ? undefined : filterTab);

  const tickets = useMemo(() => ticketPage?.items ?? [], [ticketPage]);
  const hasNextPage = ticketPage?.hasNextPage ?? false;

  const handleTabChange = useCallback((tab: TicketTabType) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'All') {
      next.delete('status');
    } else {
      next.set('status', tab);
    }
    next.delete('page');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const handlePageChange = useCallback((page: number) => {
    const next = new URLSearchParams(searchParams);
    if (page <= 1) {
      next.delete('page');
    } else {
      next.set('page', String(page));
    }
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const handleRefund = useCallback(async (ticket: TicketItemData) => {
    setRefundingId(ticket.id);
    try {
      const response = await api.post(`/api/tickets/${ticket.id}/refund`, {
        reason: 'Customer requested refund via web portal',
      });
      if (response.data.success) {
        toast.success(response.data.message || 'Yêu cầu hoàn vé đã được gửi và đang chờ xử lý.');
        setRefundCandidate(null);
        await queryClient.invalidateQueries({ queryKey: ['tickets'] });
      } else {
        toast.error(response.data.message || 'Không thể gửi yêu cầu hoàn vé.');
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Có lỗi xảy ra khi hoàn vé.');
    } finally {
      setRefundingId(null);
    }
  }, [queryClient]);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (filterTab === 'All') return true;
      return t.status.toLowerCase() === filterTab.toLowerCase();
    });
  }, [tickets, filterTab]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 pb-12 animate-pulse" aria-busy="true" aria-live="polite">
        <div className="h-28 bg-surface-2 rounded-2xl border border-border-subtle" />
        <div className="h-64 bg-surface-2 rounded-2xl border border-border-subtle" />
        <div className="h-64 bg-surface-2 rounded-2xl border border-border-subtle" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <XCircle className="w-10 h-10 text-danger" aria-hidden="true" />
        <h1 className="text-xl font-bold text-white">Không thể tải danh sách vé</h1>
        <p className="text-sm text-text-secondary">Kiểm tra kết nối và thử lại.</p>
        <button onClick={() => void refetchTickets()} className="rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer">
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12 relative text-text-primary">
      {/* Header Banner */}
      <div className="surface-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-primary/15 border border-brand-primary/30 w-fit mb-2 whitespace-nowrap">
            <Ticket className="w-3.5 h-3.5 text-brand-primary" />
            <span className="text-xs font-bold text-brand-primary uppercase tracking-wider">Vé Điện Tử Cá Nhân</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight whitespace-nowrap">
            Vé Của Tôi
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
            Mã QR tích hợp chữ ký số bảo mật HMAC-SHA256, hỗ trợ xuất file PDF và kiểm tra hạn hoàn vé.
          </p>
        </div>

        {/* Filter Tabs */}
        <TicketFilterTabs currentTab={filterTab} onTabChange={handleTabChange} />
      </div>
        
      {filteredTickets.length === 0 ? (
        <div className="text-center py-16 bg-surface-2 rounded-2xl border border-dashed border-border-subtle" aria-live="polite">
          <div className="w-12 h-12 bg-surface-3 rounded-xl flex items-center justify-center mx-auto mb-3 text-text-tertiary">
            <Ticket className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-0.5">Không tìm thấy vé nào</h3>
          <p className="text-text-secondary text-xs">
            {currentPage > 1 
              ? `Không có vé nào trên trang ${currentPage}.` 
              : 'Bạn chưa có vé nào thuộc danh mục này.'}
          </p>
          {currentPage > 1 && (
            <button
              type="button"
              onClick={() => handlePageChange(1)}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-xl bg-brand-primary text-xs font-bold text-white hover:bg-brand-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
            >
              Quay lại trang 1
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {filteredTickets.map(ticket => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              refundingId={refundingId}
              onInitiateRefund={setRefundCandidate}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      <TicketPagination
        currentPage={currentPage}
        hasNextPage={hasNextPage}
        onPageChange={handlePageChange}
        isLoading={isLoading}
      />

      {/* Refund Confirmation Modal */}
      <TicketRefundModal
        candidate={refundCandidate}
        refundingId={refundingId}
        onClose={() => setRefundCandidate(null)}
        onConfirm={handleRefund}
      />
    </div>
  );
}
