import React, { useMemo } from 'react';
import { Seat } from '../../types';
import { SeatLegend } from './SeatLegend';
import { formatCurrency } from '../../utils/formatters';

interface SeatMapProps {
  seats: Seat[];
  selectedSeat: Seat | null;
  onSeatClick: (seat: Seat) => void;
}

export const SeatMap: React.FC<SeatMapProps> = ({ seats, selectedSeat, onSeatClick }) => {
  const formatVND = (price: number) => {
    return formatCurrency(price);
  };

  const getSeatTierInfo = (seat: Seat) => {
    if (seat.tier === 1 || seat.row === 'A' || seat.row === 'B') {
      return { name: 'VIP', color: 'amber', isVip: true };
    }
    if (seat.tier === 2 || seat.row === 'E') {
      return { name: 'Economy (Tiết kiệm)', color: 'emerald', isVip: false };
    }
    return { name: 'Standard (Tiêu chuẩn)', color: 'indigo', isVip: false };
  };

  const getSeatColor = (seat: Seat, isSelected: boolean) => {
    if (isSelected) {
      return 'bg-brand-primary border-brand-primary text-white scale-105 z-20 ring-2 ring-brand-accent/60';
    }
    if (seat.status === 1) {
      return 'bg-warning/20 border-warning/50 text-warning/50 cursor-not-allowed opacity-60'; // Locked
    }
    if (seat.status === 2) {
      return 'bg-danger/20 border-danger/50 text-danger/50 cursor-not-allowed opacity-40'; // Sold
    }

    // Available seat styles by tier
    const tier = getSeatTierInfo(seat);
    if (tier.isVip) {
      return 'bg-amber-500/15 border-amber-400/70 hover:border-amber-400 hover:bg-amber-500/30 text-amber-300 cursor-pointer';
    }
    if (tier.name.includes('Economy')) {
      return 'bg-emerald-500/15 border-emerald-400/70 hover:border-emerald-400 hover:bg-emerald-500/30 text-emerald-300 cursor-pointer';
    }

    return 'bg-surface-2 border-border-subtle hover:border-brand-primary hover:bg-brand-primary/20 text-text-primary cursor-pointer';
  };

  // Group seats by row using useMemo to prevent unnecessary recalculations on re-renders
  const rows = useMemo(() => {
    return (seats || []).reduce((acc, seat) => {
      if (!acc[seat.row]) acc[seat.row] = [];
      acc[seat.row].push(seat);
      return acc;
    }, {} as Record<string, Seat[]>);
  }, [seats]);

  const sortedRowKeys = useMemo(() => Object.keys(rows).sort(), [rows]);

  return (
    <div className="surface-panel p-5 sm:p-7 md:p-8 shadow-xl relative overflow-hidden min-h-[480px] lg:min-h-[540px] flex flex-col justify-between">
      {/* Curved Stage Header */}
      <div className="mb-8 text-center relative z-10">
        <div className="w-3/5 max-w-md mx-auto h-1 bg-brand-primary rounded-full mb-3" />
        <p className="text-xs font-bold text-brand-primary uppercase tracking-[0.2em]">
          Sân khấu trung tâm
        </p>
      </div>

      {/* Mobile Scroll Hint */}
      <div className="block md:hidden text-center pb-2 text-xs text-text-tertiary font-medium">
        Vuốt ngang để xem toàn bộ sơ đồ ghế
      </div>

      {/* Seat Matrix Grid */}
      <div className="flex flex-col gap-3 sm:gap-3.5 items-center flex-1 justify-center relative z-10 overflow-x-auto pb-3 hide-scrollbar">
        {sortedRowKeys.map(rowName => {
          const isVip = rowName === 'A' || rowName === 'B';
          return (
            <div key={rowName} className="flex gap-2.5 sm:gap-4 items-center group/row">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shadow-inner ${
                isVip ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'bg-surface-3 text-text-secondary border border-border-subtle'
              }`}>
                {rowName}
              </div>
              
              <div className="flex gap-1.5 sm:gap-2 md:gap-2.5">
                {rows[rowName].sort((a, b) => a.number - b.number).map((seat, index) => {
                  const isSelected = selectedSeat?.id === seat.id;
                  return (
                    <button
                      key={seat.id}
                      onClick={() => onSeatClick(seat)}
                      disabled={seat.status !== 0}
                      aria-label={`Hàng ${seat.row}, ghế ${seat.number}, ${seat.status === 0 ? 'còn trống' : seat.status === 1 ? 'đang được giữ' : 'đã bán'}, giá ${formatVND(seat.price)}`}
                      className={`w-11 h-11 sm:w-10 sm:h-10 md:w-9 md:h-9 rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-[opacity,background-color,border-color] duration-150 ease-out relative group/seat focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1 ${getSeatColor(seat, isSelected)}`}
                      style={{ animationDelay: `${(sortedRowKeys.indexOf(rowName) * 0.04) + (index * 0.015)}s` }}
                    >
                      {seat.number}
                    </button>
                  );
                })}
              </div>

              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shadow-inner ${
                isVip ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40' : 'bg-surface-3 text-text-secondary border border-border-subtle'
              }`}>
                {rowName}
              </div>
            </div>
          );
        })}
      </div>

      {/* Enhanced Seat Legend */}
      <SeatLegend />
    </div>
  );
};
