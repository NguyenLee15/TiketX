import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ticket, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { TicketCard, TicketItemData } from './TicketCard';
import { TicketFilterTabs, allowedTicketTabs, TicketTabType } from './TicketFilterTabs';
import { TicketRefundModal } from './TicketRefundModal';

export default function MyTicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState<TicketItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundCandidate, setRefundCandidate] = useState<TicketItemData | null>(null);

  // Single Source of Truth from URL params (Zero derived effect ping-pong loops)
  const requestedTab = searchParams.get('status');
  const filterTab: TicketTabType = allowedTicketTabs.includes(requestedTab as TicketTabType) 
    ? (requestedTab as TicketTabType) 
    : 'All';

  const handleTabChange = useCallback((tab: TicketTabType) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'All') {
      next.delete('status');
    } else {
      next.set('status', tab);
    }
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const fetchTickets = useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);
      setLoadError(false);
      const response = await api.get('/api/tickets/my-tickets', { signal });
      if (response.data.success) {
        setTickets(response.data.data || []);
      } else {
        setLoadError(true);
      }
    } catch (err) {
      if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
        setLoadError(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchTickets(controller.signal);
    return () => controller.abort();
  }, [fetchTickets]);

  const handleRefund = useCallback(async (ticket: TicketItemData) => {
    setRefundingId(ticket.id);
    try {
      const response = await api.post(`/api/tickets/${ticket.id}/refund`, {
        reason: 'Customer requested refund via web portal',
      });
      if (response.data.success) {
        toast.success(response.data.message || 'Yêu cầu hoàn vé đã được gửi và đang chờ xử lý.');
        setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: 'RefundPending', canRefund: false } : t));
      } else {
        toast.error(response.data.message || 'Không thể gửi yêu cầu hoàn vé.');
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Có lỗi xảy ra khi hoàn vé.');
    } finally {
      setRefundingId(null);
    }
  }, []);

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
        <button onClick={() => void fetchTickets()} className="rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer">
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
          <p className="text-text-secondary text-xs">Bạn chưa có vé nào thuộc danh mục này.</p>
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
