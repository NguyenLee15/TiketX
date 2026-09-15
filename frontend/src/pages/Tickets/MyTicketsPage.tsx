import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, MapPin, Loader2, Download, Ticket, RotateCcw, Crown, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import api from '../../services/api';
import ConfirmModal from '../../components/Admin/ConfirmModal';

interface TicketData {
  id: string;
  eventId: string;
  seatId: string;
  eventTitle: string;
  eventDescription: string;
  eventDate: string;
  endDate: string;
  location: string;
  venueName?: string;
  category: string;
  imageUrl: string;
  row: string;
  number: number;
  tier: number; // 0: Standard, 1: VIP, 2: Economy
  price: number;
  status: string; // 'Pending' | 'Paid' | 'Cancelled' | 'Used' | 'RefundPending'
  orderCode: number;
  qrCodeSignature: string;
  paidAt?: string;
  checkedInAt?: string;
  refundAmount?: number;
  refundedAt?: string;
  refundCutoffHours: number;
  canRefund: boolean;
}

export default function MyTicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const allowedTabs = ['All', 'Paid', 'Used', 'RefundPending', 'Cancelled'] as const;
  const requestedTab = searchParams.get('status');
  const [filterTab, setFilterTab] = useState<(typeof allowedTabs)[number]>(allowedTabs.includes(requestedTab as (typeof allowedTabs)[number]) ? requestedTab as (typeof allowedTabs)[number] : 'All');
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundCandidate, setRefundCandidate] = useState<TicketData | null>(null);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (filterTab === 'All') next.delete('status'); else next.set('status', filterTab);
    setSearchParams(next);
  }, [filterTab, setSearchParams]);

  useEffect(() => {
    const requested = searchParams.get('status');
    const next = allowedTabs.includes(requested as (typeof allowedTabs)[number]) ? requested as (typeof allowedTabs)[number] : 'All';
    setFilterTab(next);
  }, [searchParams]);

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
    } catch (error) {
      if ((error as { code?: string })?.code === 'ERR_CANCELED') return;
      setLoadError(true);
      toast.error('Không thể tải danh sách vé của bạn');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchTickets(controller.signal);
    return () => controller.abort();
  }, [fetchTickets]);

  const handleRefund = async (ticket: TicketData) => {
    setRefundingId(ticket.id);
    try {
      const response = await api.post(`/api/tickets/${ticket.id}/refund`, {
        reason: 'Khách hàng yêu cầu hoàn vé qua ứng dụng'
      });

      if (response.data.success) {
        toast.success(response.data.message || 'Yêu cầu hoàn vé đã được tiếp nhận.');
        await fetchTickets();
      } else {
        toast.error(response.data.message || 'Không thể hoàn vé');
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      const msg = apiErr.response?.data?.message || 'Lỗi khi hoàn vé. Vui lòng liên hệ ban tổ chức!';
      toast.error(msg);
    } finally {
      setRefundingId(null);
    }
  };

  const getQrImageDataUrl = (ticketId: string): Promise<string> => {
    return new Promise((resolve) => {
      const svgEl = document.getElementById(`qr-svg-${ticketId}`);
      if (!svgEl) {
        resolve('');
        return;
      }
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, 400, 400);
          ctx.drawImage(img, 0, 0, 400, 400);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve('');
        }
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('');
      };
      img.src = url;
    });
  };

  const handleDownloadPdf = async (ticket: TicketData) => {
    try {
      toast.loading('Đang xuất vé PDF vector độ nét cao...', { id: 'pdf-toast' });

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [210, 85]
      });

      // Background Card
      doc.setFillColor(15, 17, 23);
      doc.roundedRect(5, 5, 200, 75, 4, 4, 'F');

      // Left Accent Bar
      doc.setFillColor(99, 102, 241);
      doc.rect(5, 5, 4, 75, 'F');

      // Header Branding
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('TICKEX ENTERTAINMENT', 15, 15);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(156, 163, 175);
      doc.text('OFFICIAL E-TICKET / VE DIEN TU', 15, 20);

      // Event Title
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      const displayTitle = ticket.eventTitle.length > 36 ? ticket.eventTitle.substring(0, 33) + '...' : ticket.eventTitle;
      doc.text(displayTitle, 15, 28);

      // Event Date & Location
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(209, 213, 219);
      const dateStr = new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(ticket.eventDate));
      doc.text(`Thoi gian: ${dateStr}`, 15, 35);

      const locationStr = (ticket.venueName || ticket.location).length > 45 
        ? (ticket.venueName || ticket.location).substring(0, 42) + '...' 
        : (ticket.venueName || ticket.location);
      doc.text(`Dia diem: ${locationStr}`, 15, 41);

      // Seat Details Card
      doc.setFillColor(24, 28, 40);
      doc.roundedRect(15, 45, 125, 20, 2, 2, 'F');
      doc.setDrawColor(45, 55, 72);
      doc.roundedRect(15, 45, 125, 20, 2, 2, 'S');

      doc.setFontSize(7.5);
      doc.setTextColor(156, 163, 175);
      doc.text('HANG (ROW)', 20, 51);
      doc.text('GHE (SEAT)', 45, 51);
      doc.text('HANG VE (TIER)', 72, 51);
      doc.text('GIA VE (PRICE)', 105, 51);

      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(ticket.row, 20, 59);
      doc.text(ticket.number.toString(), 45, 59);

      const tierName = ticket.tier === 1 ? 'VIP' : ticket.tier === 2 ? 'ECONOMY' : 'STANDARD';
      if (ticket.tier === 1) doc.setTextColor(245, 158, 11);
      else if (ticket.tier === 2) doc.setTextColor(16, 185, 129);
      else doc.setTextColor(255, 255, 255);
      doc.text(tierName, 72, 59);

      doc.setTextColor(52, 211, 153);
      doc.text(`${new Intl.NumberFormat('vi-VN').format(ticket.price)} VND`, 105, 59);

      // Footer Meta
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(`Don hang: #${ticket.orderCode}  |  Ma ve: ${ticket.id.substring(0, 18)}...`, 15, 72);

      // Perforated Divider Line
      doc.setDrawColor(75, 85, 99);
      doc.setLineDashPattern([2, 2], 0);
      doc.line(148, 8, 148, 77);
      doc.setLineDashPattern([], 0);

      // Right Stub: QR Code
      const qrDataUrl = await getQrImageDataUrl(ticket.id);
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', 155, 10, 42, 42);
      }

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('MA SOAT VE', 176, 58, { align: 'center' });

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(156, 163, 175);
      doc.text(`CODE: #${ticket.orderCode}`, 176, 63, { align: 'center' });

      const statusText = ticket.status.toLowerCase();
      if (statusText === 'paid') {
        doc.setTextColor(52, 211, 153);
        doc.text('HOP LE (PAID)', 176, 69, { align: 'center' });
      } else {
        doc.setTextColor(156, 163, 175);
        const statusLabels: Record<string, string> = {
          pending: 'CHO THANH TOAN',
          used: 'DA QUA CUA',
          refundpending: 'DANG HOAN TIEN',
          cancelled: 'DA HUY',
        };
        doc.text(statusLabels[statusText] || 'KHONG XAC DINH', 176, 69, { align: 'center' });
      }

      doc.save(`TickeX_Ticket_${ticket.orderCode}_${ticket.row}${ticket.number}.pdf`);
      toast.success('Đã tải xuống vé PDF vector thành công!', { id: 'pdf-toast' });
    } catch {
      toast.error('Lỗi khi tạo file PDF', { id: 'pdf-toast' });
    }
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (filterTab === 'All') return true;
      return t.status.toLowerCase() === filterTab.toLowerCase();
    });
  }, [tickets, filterTab]);

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'paid') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-success/15 text-success border border-success/30 uppercase tracking-wider whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" /> Hợp Lệ
        </span>
      );
    }
    if (s === 'used') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-surface-3 text-text-tertiary border border-border-subtle uppercase tracking-wider whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" /> Đã Qua Cửa
        </span>
      );
    }
    if (s === 'refundpending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-warning/15 text-warning border border-warning/30 uppercase tracking-wider whitespace-nowrap shrink-0">
          <Clock className="w-3.5 h-3.5" /> Đang Hoàn Tiền
        </span>
      );
    }
    if (s === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-danger/15 text-danger border border-danger/30 uppercase tracking-wider whitespace-nowrap shrink-0">
          <XCircle className="w-3.5 h-3.5" /> Đã Hủy
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-warning/15 text-warning border border-warning/30 uppercase tracking-wider whitespace-nowrap shrink-0">
        <Clock className="w-3.5 h-3.5" /> Chờ Thanh Toán
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-4xl mx-auto flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
        <XCircle className="w-10 h-10 text-danger" aria-hidden="true" />
        <h1 className="text-xl font-bold text-white">Không thể tải danh sách vé</h1>
        <p className="text-sm text-text-secondary">Kiểm tra kết nối và thử lại.</p>
        <button onClick={() => void fetchTickets()} className="rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-brand-primary">
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
        <div className="flex gap-1.5 bg-surface-1/80 p-1.5 rounded-xl border border-border-subtle self-start sm:self-center shrink-0">
          {(['All', 'Paid', 'Used', 'RefundPending', 'Cancelled'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                filterTab === tab 
                  ? 'bg-brand-primary text-white shadow-md shadow-brand-glow' 
                  : 'text-text-secondary hover:text-white hover:bg-surface-2'
              }`}
            >
              {tab === 'All' ? 'Tất cả' : tab === 'Paid' ? 'Còn hạn' : tab === 'Used' ? 'Đã qua cửa' : tab === 'RefundPending' ? 'Đang hoàn' : 'Đã hủy'}
            </button>
          ))}
        </div>
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
          {filteredTickets.map(ticket => {
            const isVip = ticket.tier === 1 || ticket.row === 'A' || ticket.row === 'B';
            const hasSignedQr = Boolean(ticket.qrCodeSignature?.trim());
            const canShowQr = hasSignedQr && ['paid', 'used'].includes(ticket.status.toLowerCase());

            return (
              <div 
                id={`ticket-${ticket.id}`} 
                key={ticket.id} 
                className="surface-panel rounded-2xl overflow-hidden shadow-xl flex flex-col md:flex-row relative group"
              >
                
                {/* Left: Concert Pass Information */}
                <div className="p-5 sm:p-6 flex-1 border-b md:border-b-0 md:border-r border-border-subtle border-dashed relative z-10 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      {getStatusBadge(ticket.status)}

                      {isVip && (
                        <span className="inline-flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 whitespace-nowrap shrink-0">
                          <Crown className="w-3 h-3" /> HẠNG VIP
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-xl sm:text-2xl font-display font-black text-white tracking-tight leading-snug">
                      {ticket.eventTitle}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-2 text-text-secondary text-xs">
                      <div className="flex items-center bg-surface-2/60 px-2.5 py-1 rounded-lg border border-border-subtle whitespace-nowrap">
                        <Calendar className="w-3.5 h-3.5 mr-1.5 text-brand-secondary shrink-0" />
                        <span className="font-semibold text-white">
                          {formatDate(ticket.eventDate, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex items-center bg-surface-2/60 px-2.5 py-1 rounded-lg border border-border-subtle whitespace-nowrap max-w-full">
                        <MapPin className="w-3.5 h-3.5 mr-1.5 text-brand-primary shrink-0" />
                        <span className="font-semibold text-white truncate">{ticket.venueName || ticket.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Seat Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    <div className="bg-surface-2/70 p-2.5 rounded-xl border border-border-subtle text-center">
                      <div className="text-[10px] text-text-tertiary uppercase tracking-wider font-bold mb-0.5 whitespace-nowrap">Hàng Ghế</div>
                      <div className="font-black text-lg text-white font-display whitespace-nowrap">{ticket.row}</div>
                    </div>
                    <div className="bg-surface-2/70 p-2.5 rounded-xl border border-border-subtle text-center">
                      <div className="text-[10px] text-text-tertiary uppercase tracking-wider font-bold mb-0.5 whitespace-nowrap">Số Ghế</div>
                      <div className="font-black text-lg text-white font-display whitespace-nowrap">{ticket.number}</div>
                    </div>
                    <div className="bg-surface-2/70 p-2.5 rounded-xl border border-border-subtle text-center">
                      <div className="text-[10px] text-text-tertiary uppercase tracking-wider font-bold mb-0.5 whitespace-nowrap">Hạng Vé</div>
                      <div className="font-bold text-xs sm:text-sm text-brand-secondary font-display mt-0.5 whitespace-nowrap">
                        {isVip ? 'VIP' : ticket.tier === 2 ? 'Tiết Kiệm' : 'Tiêu Chuẩn'}
                      </div>
                    </div>
                    <div className="bg-surface-2/70 p-2.5 rounded-xl border border-border-subtle text-center">
                      <div className="text-[10px] text-text-tertiary uppercase tracking-wider font-bold mb-0.5 whitespace-nowrap">Giá Vé</div>
                      <div className="font-black text-xs sm:text-sm text-success font-display mt-0.5 whitespace-nowrap">
                        {formatCurrency(ticket.price)}
                      </div>
                    </div>
                  </div>

                  {/* Refund Notice / Button */}
                  {ticket.status.toLowerCase() === 'paid' && (
                    <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 border-t border-border-subtle/60 text-xs">
                      <div className="text-text-tertiary flex items-center gap-1.5 text-[11px] whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 text-warning shrink-0" />
                        <span>Hạn hoàn vé: Trước giờ diễn {ticket.refundCutoffHours}h</span>
                      </div>

                      {ticket.canRefund ? (
                        <button
                          onClick={() => setRefundCandidate(ticket)}
                          disabled={refundingId === ticket.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 font-bold transition-colors text-xs whitespace-nowrap shrink-0"
                        >
                          {refundingId === ticket.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          <span>Yêu Cầu Hoàn Vé</span>
                        </button>
                      ) : (
                        <span className="text-text-tertiary text-[11px] italic whitespace-nowrap">
                          (Đã quá hạn hoàn vé)
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Right: Live QR Code & Download Box */}
                <div className="p-5 sm:p-6 flex flex-col items-center justify-center md:w-72 bg-surface-2 relative z-10 space-y-3 shrink-0">
                  {canShowQr ? (
                    <div className="bg-white p-3 rounded-xl shadow-xl relative group-hover:scale-105 transition-transform">
                      <QRCodeSVG id={`qr-svg-${ticket.id}`} value={ticket.qrCodeSignature} size={135} level="H" />
                    </div>
                  ) : (
                    <div className="flex h-[159px] w-[159px] items-center justify-center rounded-xl border border-border-subtle bg-surface-3 p-4 text-center text-xs text-text-tertiary">
                      QR sẽ hiển thị sau khi thanh toán được xác nhận.
                    </div>
                  )}

                  <div className="text-center">
                    <p className="text-[11px] font-mono font-bold text-text-secondary uppercase tracking-wider whitespace-nowrap">
                      Mã đơn: #{ticket.orderCode}
                    </p>
                    <p className="text-[10px] text-text-tertiary whitespace-nowrap">
                      {ticket.status.toLowerCase() === 'used' 
                        ? `Đã soát vé lúc ${formatTime(ticket.checkedInAt || '')}` 
                        : 'Xuất trình mã QR tại cổng soát vé'}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDownloadPdf(ticket)}
                    disabled={!canShowQr}
                    className="flex items-center justify-center w-full py-2.5 bg-surface-3 hover:bg-surface-2 border border-border-subtle hover:border-brand-primary text-white text-xs font-bold rounded-xl transition-[background-color,border-color,opacity,transform] shadow-md group/btn active:scale-95 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-subtle"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5 group-hover/btn:-translate-y-0.5 transition-transform text-brand-primary shrink-0" />
                    <span>Tải File Vé PDF Chuẩn</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(refundCandidate)}
        onClose={() => { if (!refundingId) setRefundCandidate(null); }}
        onConfirm={async () => {
          if (!refundCandidate) return;
          await handleRefund(refundCandidate);
          setRefundCandidate(null);
        }}
        isLoading={Boolean(refundingId)}
        title="Xác nhận yêu cầu hoàn vé"
        confirmText="Gửi yêu cầu hoàn"
        type="warning"
        message={refundCandidate ? (
          <div className="space-y-2">
            <p>Bạn đang yêu cầu hoàn vé cho <strong>{refundCandidate.eventTitle}</strong>, hàng {refundCandidate.row} – ghế {refundCandidate.number}.</p>
            <p>Số tiền dự kiến: <strong>{formatCurrency(refundCandidate.price)}</strong>.</p>
            <p className="text-warning">Vé sẽ chuyển sang trạng thái “Đang hoàn tiền” và chỉ hoàn tất sau khi cổng thanh toán xác nhận.</p>
          </div>
        ) : ''}
      />
    </div>
  );
}
