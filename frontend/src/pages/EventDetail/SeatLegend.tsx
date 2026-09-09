import React from 'react';
import { Crown } from 'lucide-react';

export const SeatLegend: React.FC = () => {
  return (
    <div className="mt-6 pt-4 flex flex-wrap justify-center gap-x-3 gap-y-2 border-t border-border-subtle relative z-10 text-xs">
      <div className="flex items-center gap-1.5 bg-surface-2/60 px-2.5 py-1 rounded-lg border border-border-subtle whitespace-nowrap shrink-0">
        <div className="w-3 h-3 rounded-t bg-amber-500/20 border border-amber-400 shrink-0" />
        <span className="text-amber-300 font-bold flex items-center gap-1">
          <Crown className="w-2.5 h-2.5" /> Hạng VIP (Hàng A-B)
        </span>
      </div>
      <div className="flex items-center gap-1.5 bg-surface-2/60 px-2.5 py-1 rounded-lg border border-border-subtle whitespace-nowrap shrink-0">
        <div className="w-3 h-3 rounded-t bg-surface-2 border border-border-subtle shrink-0" />
        <span className="text-text-primary font-medium">Hạng Tiêu Chuẩn (Hàng C-D)</span>
      </div>
      <div className="flex items-center gap-1.5 bg-surface-2/60 px-2.5 py-1 rounded-lg border border-border-subtle whitespace-nowrap shrink-0">
        <div className="w-3 h-3 rounded-t bg-emerald-500/20 border border-emerald-400 shrink-0" />
        <span className="text-emerald-300 font-medium">Hạng Tiết Kiệm (Hàng E)</span>
      </div>
      <div className="flex items-center gap-1.5 bg-surface-2/60 px-2.5 py-1 rounded-lg border border-border-subtle whitespace-nowrap shrink-0">
        <div className="w-3 h-3 rounded-t bg-brand-primary border border-brand-primary shadow-sm shadow-brand-glow shrink-0" />
        <span className="text-white font-bold">Đang chọn</span>
      </div>
      <div className="flex items-center gap-1.5 bg-surface-2/60 px-2.5 py-1 rounded-lg border border-border-subtle whitespace-nowrap shrink-0">
        <div className="w-3 h-3 rounded-t bg-warning/20 border border-warning/50 shrink-0" />
        <span className="text-text-secondary font-medium">Đang giữ chỗ (5p)</span>
      </div>
      <div className="flex items-center gap-1.5 bg-surface-2/60 px-2.5 py-1 rounded-lg border border-border-subtle whitespace-nowrap shrink-0">
        <div className="w-3 h-3 rounded-t bg-danger/20 border border-danger/50 shrink-0" />
        <span className="text-text-secondary font-medium">Đã bán</span>
      </div>
    </div>
  );
};

