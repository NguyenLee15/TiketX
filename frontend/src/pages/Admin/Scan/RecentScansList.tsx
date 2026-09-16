import React from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, AlertOctagon, XCircle } from 'lucide-react';
import { ScanResult } from './ScanResultDisplay';

interface RecentScansListProps {
  recentScans: ScanResult[];
}

export const RecentScansList: React.FC<RecentScansListProps> = ({ recentScans }) => {
  return (
    <div className="surface-panel p-5 sm:p-6">
      <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-brand-primary" />
        Lịch sử soát vé gần nhất
      </h3>

      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {recentScans.map((item, idx) => (
          <div key={idx} className="p-2.5 bg-surface-2/40 rounded-xl border border-border-subtle flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 truncate">
              {item.status === 'valid' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {item.status === 'already_used' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
              {item.status === 'conflict' && <AlertOctagon className="w-4 h-4 text-amber-300 shrink-0" />}
              {item.status === 'invalid' && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
              <div className="truncate">
                <p className="font-bold text-white truncate">{item.ticket?.attendeeName || (item.status === 'conflict' ? 'Xung đột trạm quét' : 'Từ chối vào cổng')}</p>
                <p className="text-[10px] text-text-secondary truncate">
                  {item.ticket ? `Hàng ${item.ticket.row} - Ghế ${item.ticket.number}` : item.message}
                </p>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
              item.status === 'valid' ? 'bg-emerald-500/10 text-emerald-400' :
              item.status === 'already_used' ? 'bg-amber-500/10 text-amber-400' : 
              item.status === 'conflict' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/10 text-red-400'
            }`}>
              {item.status === 'valid' ? 'Hợp Lệ' : item.status === 'already_used' ? 'Đã Quét' : item.status === 'conflict' ? 'Xung Đột' : 'Từ Chối'}
            </span>
          </div>
        ))}

        {recentScans.length === 0 && (
          <p className="text-xs text-text-secondary text-center py-4">Chưa có lượt quét nào trong phiên này.</p>
        )}
      </div>
    </div>
  );
};
