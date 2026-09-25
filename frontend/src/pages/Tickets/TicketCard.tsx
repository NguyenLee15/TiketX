import React from 'react';
import { Calendar, MapPin, Loader2, Download, RotateCcw, Crown, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency, formatDate, formatTime } from '../../utils/formatters';

export interface TicketItemData {
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
  tier: number;
  price: number;
  status: string;
  orderCode: number;
  qrCodeSignature: string;
  paidAt?: string;
  checkedInAt?: string;
  refundAmount?: number;
  refundedAt?: string;
  refundCutoffHours: number;
  canRefund: boolean;
}

interface TicketCardProps {
  ticket: TicketItemData;
  refundingId: string | null;
  onInitiateRefund: (ticket: TicketItemData) => void;
}

export const TicketCard: React.FC<TicketCardProps> = React.memo(({
  ticket,
  refundingId,
  onInitiateRefund,
}) => {
  const isVip = ticket.tier === 1 || ticket.row === 'A' || ticket.row === 'B';
  const hasSignedQr = Boolean(ticket.qrCodeSignature?.trim());
  const canShowQr = hasSignedQr && ['paid', 'used'].includes(ticket.status.toLowerCase());
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);

  const handleDownloadPdf = React.useCallback(async () => {
    if (!canShowQr || isDownloadingPdf) return;
    try {
      setIsDownloadingPdf(true);
      const { generateTicketPdf } = await import('../../utils/ticketPdfGenerator');
      await generateTicketPdf(ticket);
    } catch (err) {
      console.error('Failed to generate ticket PDF', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [canShowQr, isDownloadingPdf, ticket]);

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

  return (
    <div 
      id={`ticket-${ticket.id}`} 
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
                onClick={() => onInitiateRefund(ticket)}
                disabled={refundingId === ticket.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 font-bold transition-colors text-xs whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
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
          onClick={handleDownloadPdf}
          disabled={!canShowQr || isDownloadingPdf}
          className="flex items-center justify-center w-full py-2.5 bg-surface-3 hover:bg-surface-2 border border-border-subtle hover:border-brand-primary text-white text-xs font-bold rounded-xl transition-[background-color,border-color,opacity,transform] shadow-md group/btn active:scale-95 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border-subtle cursor-pointer"
        >
          {isDownloadingPdf ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin text-brand-primary shrink-0" />
          ) : (
            <Download className="w-3.5 h-3.5 mr-1.5 group-hover/btn:-translate-y-0.5 transition-transform text-brand-primary shrink-0" />
          )}
          <span>{isDownloadingPdf ? 'Đang tạo file PDF...' : 'Tải File Vé PDF Chuẩn'}</span>
        </button>
      </div>
    </div>
  );
});

