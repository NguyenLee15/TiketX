import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ticket, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { TicketCard, TicketItemData } from './TicketCard';
import { TicketFilterTabs, allowedTicketTabs, TicketTabType } from './TicketFilterTabs';
import { TicketRefundModal } from './TicketRefundModal';
import { TicketPagination } from './TicketPagination';
import { useMyTicketsQuery, useMyTicketsCursorQuery } from '../../hooks/useCustomerQueries';

const PAGE_SIZE = 10;

export default function MyTicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundCandidate, setRefundCandidate] = useState<TicketItemData | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  // Single Source of Truth from URL params (Zero derived effect ping-pong loops)
  const requestedTab = searchParams.get('status');
  const filterTab: TicketTabType = allowedTicketTabs.includes(requestedTab as TicketTabType) 
    ? (requestedTab as TicketTabType) 
    : 'All';

  const cursorParam = searchParams.get('cursor') || undefined;
  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const urlPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const isLegacyOffset = !cursorParam && urlPage > 1;
  const currentPage = urlPage;
  const currentCursor = cursorParam;

  useEffect(() => {
    if (!cursorParam) {
      setCursorHistory([]);
    } else {
      setCursorHistory(prev => (prev.includes(cursorParam) ? prev : [...prev, cursorParam]));
    }
  }, [cursorParam]);

  const statusFilter = filterTab === 'All' ? undefined : filterTab;
  const cursorQuery = useMyTicketsCursorQuery(currentCursor, PAGE_SIZE, statusFilter, { enabled: !isLegacyOffset });
  const offsetQuery = useMyTicketsQuery(urlPage, PAGE_SIZE, statusFilter, { enabled: isLegacyOffset });

  const tickets = isLegacyOffset ? (offsetQuery.data ?? []) : (cursorQuery.data?.items ?? []);
  const isLoading = isLegacyOffset ? offsetQuery.isLoading : cursorQuery.isLoading;
  const loadError = isLegacyOffset ? offsetQuery.isError : cursorQuery.isError;
  const refetchTickets = isLegacyOffset ? offsetQuery.refetch : cursorQuery.refetch;
  const hasNextPage = isLegacyOffset
    ? (offsetQuery.data?.length ?? 0) >= PAGE_SIZE
    : (cursorQuery.data?.hasMore ?? false);
  const hasPrevPage = isLegacyOffset
    ? urlPage > 1
    : (urlPage > 1 || Boolean(cursorParam) || cursorHistory.length > 0);

  const handleTabChange = useCallback((tab: TicketTabType) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'All') {
      next.delete('status');
    } else {
      next.set('status', tab);
    }
    next.delete('page');
    next.delete('cursor');
    setCursorHistory([]);
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const handleResetToFirstPage = useCallback(() => {
    setCursorHistory([]);
    const next = new URLSearchParams(searchParams);
    next.delete('page');
    next.delete('cursor');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const handleNextPage = useCallback(() => {
    if (isLegacyOffset) {
      const next = new URLSearchParams(searchParams);
      next.set('page', String(urlPage + 1));
      setSearchParams(next);
      return;
    }

    if (cursorQuery.data?.nextCursor) {
      const nextCursor = cursorQuery.data.nextCursor;
      setCursorHistory(prev => (prev.includes(nextCursor) ? prev : [...prev, nextCursor]));
      const next = new URLSearchParams(searchParams);
      next.set('cursor', nextCursor);
      next.set('page', String(currentPage + 1));
      setSearchParams(next);
    }
  }, [isLegacyOffset, urlPage, cursorQuery.data?.nextCursor, currentPage, searchParams, setSearchParams]);

  const handlePreviousPage = useCallback(() => {
    if (isLegacyOffset) {
      const prevPage = Math.max(1, urlPage - 1);
      const next = new URLSearchParams(searchParams);
      if (prevPage <= 1) next.delete('page');
      else next.set('page', String(prevPage));
      setSearchParams(next);
      return;
    }

    if (cursorHistory.length > 1) {
      const newHistory = cursorHistory.slice(0, -1);
      const prevCursor = newHistory[newHistory.length - 1];
      setCursorHistory(newHistory);
      const next = new URLSearchParams(searchParams);
      next.set('cursor', prevCursor);
      const prevPage = Math.max(1, currentPage - 1);
      if (prevPage <= 1) next.delete('page');
      else next.set('page', String(prevPage));
      setSearchParams(next);
    } else {
      setCursorHistory([]);
      const next = new URLSearchParams(searchParams);
      next.delete('cursor');
      next.delete('page');
      setSearchParams(next);
    }
  }, [isLegacyOffset, urlPage, cursorHistory, currentPage, searchParams, setSearchParams]);

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
            <Ticket className="w-3.5 h-3.5 text-brand-primary" aria-hidden="true" />
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
        
      {tickets.length === 0 ? (
        <div className="text-center py-16 bg-surface-2 rounded-2xl border border-dashed border-border-subtle" aria-live="polite">
          <div className="w-12 h-12 bg-surface-3 rounded-xl flex items-center justify-center mx-auto mb-3 text-text-tertiary">
            <Ticket className="w-6 h-6" aria-hidden="true" />
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
              onClick={handleResetToFirstPage}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-xl bg-brand-primary text-xs font-bold text-white hover:bg-brand-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
            >
              Quay lại trang 1
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {tickets.map(ticket => (
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
        hasPrevPage={hasPrevPage}
        hasNextPage={hasNextPage}
        onPrevious={handlePreviousPage}
        onNext={handleNextPage}
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
