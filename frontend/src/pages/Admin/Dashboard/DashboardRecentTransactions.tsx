import { DollarSign } from 'lucide-react';
import { RecentTransaction } from './types';

interface DashboardRecentTransactionsProps {
  recentTransactions?: RecentTransaction[];
}

export function DashboardRecentTransactions({ recentTransactions }: DashboardRecentTransactionsProps) {
  const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
  const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="lg:col-span-6 surface-panel p-5 sm:p-6">
      <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2 whitespace-nowrap">
        <DollarSign className="w-4 h-4 text-success" />
        Lịch Sử Giao Dịch Mới Nhất
      </h2>

      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        {recentTransactions && recentTransactions.length > 0 ? (
          recentTransactions.map((tx) => (
            <div key={tx.ticketId} className="p-3 rounded-xl bg-surface-2/40 border border-border-subtle flex items-center justify-between text-xs gap-3">
              <div className="space-y-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-brand-primary text-[11px] whitespace-nowrap">#{tx.orderCode}</span>
                  <span className="font-bold text-white truncate">{tx.userName}</span>
                </div>
                <p className="text-[11px] text-text-secondary line-clamp-1">{tx.eventTitle}</p>
                <p className="text-[10px] text-text-tertiary whitespace-nowrap">{dateTimeFormatter.format(new Date(tx.createdAt))}</p>
              </div>

              <div className="text-right space-y-1 shrink-0 whitespace-nowrap">
                <span className="font-display font-black text-white text-xs sm:text-sm block">
                  {currencyFormatter.format(tx.amount)}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block whitespace-nowrap ${
                  tx.status === 'Paid' ? 'bg-success/15 text-success' :
                  tx.status === 'Used' ? 'bg-surface-3 text-text-tertiary' :
                  tx.status === 'Cancelled' ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'
                }`}>
                  {tx.status === 'Paid' ? 'Đã thanh toán' :
                   tx.status === 'Used' ? 'Đã vào cổng' :
                   tx.status === 'Cancelled' ? 'Đã hoàn vé' :
                   tx.status === 'RefundPending' ? 'Chờ hoàn tiền' : 'Chờ xử lý'}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-text-secondary text-xs text-center py-6">Chưa có giao dịch nào.</p>
        )}
      </div>
    </div>
  );
}

