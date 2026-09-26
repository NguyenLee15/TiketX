import React from 'react';
import { Clock } from 'lucide-react';
import { EventDetail, Seat } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface CheckoutInvoiceProps {
  event: EventDetail;
  seat: Seat;
  timeLeft: number;
  formatTime: (seconds: number) => string;
  status: 'idle' | 'verifying' | 'success' | 'error';
}

export const CheckoutInvoice: React.FC<CheckoutInvoiceProps> = React.memo(({
  event,
  seat,
  timeLeft,
  formatTime,
  status,
}) => {
  const getTierName = (tier: number, row: string) => {
    if (tier === 1 || row === 'A' || row === 'B') return 'Hạng VIP';
    if (tier === 2) return 'Tiết Kiệm';
    return 'Tiêu Chuẩn';
  };

  return (
    <div className="space-y-4">
      {/* Event Meta Header */}
      <div className="flex gap-4 p-4 rounded-2xl bg-surface-2/40 border border-border-subtle items-center">
        {event.imageUrl ? (
          <img src={event.imageUrl} alt={event.title} className="w-16 h-16 rounded-xl object-cover border border-border-subtle shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-surface-3 flex items-center justify-center text-text-tertiary shrink-0 font-bold">
            TICKEX
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-display font-bold text-sm truncate">{event.title}</h3>
          <p className="text-text-secondary text-xs truncate mt-0.5">{event.venueName || event.location}</p>
          <p className="text-text-tertiary text-[11px] mt-0.5">
            {formatDate(event.date, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Countdown Timer Strip */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-2/60 border border-border-subtle text-xs">
        <div className="flex items-center gap-2 text-text-secondary">
          <Clock className="w-4 h-4 text-warning animate-pulse" />
          <span>Thời gian giữ chỗ còn lại:</span>
        </div>
        <span className={`font-mono font-bold text-sm ${timeLeft < 60 ? 'text-danger-readable animate-pulse' : 'text-warning'}`}>
          {status === 'error' ? 'Hết hạn' : formatTime(timeLeft)}
        </span>
      </div>

      {/* Seat & Price Breakdown Card */}
      <div className="p-4 rounded-2xl bg-surface-2/40 border border-border-subtle space-y-2.5 text-xs">
        <div className="flex justify-between items-center text-text-secondary">
          <span>Vị trí ghế:</span>
          <span className="font-bold text-white bg-surface-3 px-2 py-0.5 rounded-md border border-border-subtle">
            Hàng {seat.row} - Ghế {seat.number} ({getTierName(seat.tier, seat.row)})
          </span>
        </div>

        <div className="flex justify-between items-center text-text-secondary">
          <span>Đơn giá vé:</span>
          <span className="text-white font-medium">{formatCurrency(seat.price)}</span>
        </div>

        <div className="flex justify-between items-center text-text-secondary">
          <span>Phí dịch vụ & xuất vé:</span>
          <span className="text-success font-medium">Miễn phí</span>
        </div>

        <div className="pt-2 border-t border-border-subtle/60 flex justify-between items-center">
          <span className="text-white font-bold text-sm">Tổng thanh toán:</span>
          <span className="text-brand-readable font-black text-base font-display">
            {formatCurrency(seat.price)}
          </span>
        </div>
      </div>
    </div>
  );
});
