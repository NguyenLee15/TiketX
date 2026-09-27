import React from 'react';
import { Check, Clock, Loader2, ArrowRight, ShieldAlert, Zap } from 'lucide-react';
import { Seat } from '../../types';
import { formatCurrency } from '../../utils/formatters';

interface SelectedSeatPanelProps {
  selectedSeat: Seat | null;
  lockTimeLeft: number | null;
  locking: boolean;
  onBookTicket: () => void;
}

const formatTimer = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const SelectedSeatPanel: React.FC<SelectedSeatPanelProps> = ({
  selectedSeat,
  lockTimeLeft,
  locking,
  onBookTicket,
}) => {
  return (
    <div className="surface-panel p-5 sm:p-6 relative overflow-hidden">
      <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-surface-3 flex items-center justify-center text-brand-primary">
          <Check className="w-3.5 h-3.5" />
        </div>
        Thông Tin Ghế Đang Chọn
      </h3>

      {selectedSeat ? (
        <div className="space-y-4 animate-slide-up">
          <div className="flex justify-between items-center bg-surface-2/80 p-4 rounded-xl border border-brand-primary/40 shadow-inner relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider mb-0.5">Vị trí ghế</p>
              <p className="text-xl font-black text-white font-display tracking-tight">
                Hàng {selectedSeat.row} <span className="text-brand-primary">-</span> Ghế {selectedSeat.number}
              </p>
            </div>
            <div className="text-right relative z-10">
              <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider mb-0.5">Giá vé</p>
              <p className="text-xl font-black text-success font-display tracking-tight">{formatCurrency(selectedSeat.price)}</p>
            </div>
          </div>

          {/* Lock Countdown Timer Display */}
          {lockTimeLeft !== null && (
            <div className="p-3 bg-surface-2 rounded-xl border border-warning/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-warning/20 border border-warning/30 flex items-center justify-center text-warning">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[9px] font-bold text-text-secondary uppercase">Thời gian giữ chỗ</p>
                  <p className="text-[11px] text-warning font-bold">Đang khóa độc quyền</p>
                </div>
              </div>
              <span role="timer" aria-live={lockTimeLeft <= 60 ? 'polite' : undefined} aria-atomic="true" className="text-xl font-mono font-black text-warning bg-warning/10 px-2.5 py-0.5 rounded-lg border border-warning/20">
                {formatTimer(lockTimeLeft)}
              </span>
            </div>
          )}

          <button
            onClick={onBookTicket}
            disabled={locking}
            className="w-full py-3.5 bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-[background-color,transform] flex items-center justify-center text-sm group relative overflow-hidden active:scale-98 focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            {locking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Khóa Ghế & Đặt Vé</span>
                <ArrowRight className="ml-1.5 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          <div className="flex items-start gap-2 bg-warning/10 p-3 rounded-lg border border-warning/20 text-warning text-[11px] font-medium leading-relaxed">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p>Hệ thống tự động khóa giữ ghế độc quyền cho bạn trong 5 phút để hoàn tất thanh toán an toàn.</p>
          </div>
        </div>
      ) : (
        <div className="text-center p-6 border-2 border-dashed border-border-subtle rounded-xl bg-surface-2/30">
          <div className="w-10 h-10 bg-surface-3 rounded-xl flex items-center justify-center mx-auto mb-2 text-text-tertiary">
            <Zap className="w-5 h-5 text-brand-primary" />
          </div>
          <p className="text-white font-bold text-xs sm:text-sm mb-0.5">Chưa chọn ghế</p>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            Nhấp vào bất kỳ ghế nào trên sơ đồ khán đài bên phải để xem giá và tiến hành giữ chỗ.
          </p>
        </div>
      )}
    </div>
  );
};
