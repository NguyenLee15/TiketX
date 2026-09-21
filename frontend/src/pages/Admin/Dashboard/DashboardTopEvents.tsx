import { Activity } from 'lucide-react';
import { TopEvent } from './types';

interface DashboardTopEventsProps {
  topEvents?: TopEvent[];
}

export function DashboardTopEvents({ topEvents }: DashboardTopEventsProps) {
  const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

  return (
    <div className="lg:col-span-6 surface-panel p-5 sm:p-6">
      <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2 whitespace-nowrap">
        <Activity className="w-4 h-4 text-brand-primary" />
        Top Sự Kiện Bán Chạy Nhất
      </h2>

      <div className="space-y-3">
        {topEvents && topEvents.length > 0 ? (
          topEvents.map((evt) => {
            const fillPercent = evt.totalSeats > 0 ? Math.round((evt.ticketsSold / evt.totalSeats) * 100) : 0;
            return (
              <div key={evt.id} className="space-y-2 p-3.5 rounded-xl bg-surface-2/40 border border-border-subtle">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-white text-xs sm:text-sm line-clamp-1">{evt.title}</h4>
                    <span className="text-[10px] uppercase font-bold text-text-tertiary px-2 py-0.5 rounded bg-surface-3 mt-1 inline-block whitespace-nowrap">
                      {evt.category}
                    </span>
                  </div>
                  <div className="text-right shrink-0 whitespace-nowrap">
                    <span className="font-display font-black text-white text-xs sm:text-sm block">
                      {currencyFormatter.format(evt.revenue)}
                    </span>
                    <p className="text-[11px] text-text-secondary whitespace-nowrap">{evt.ticketsSold}/{evt.totalSeats} ghế</p>
                  </div>
                </div>

                <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-brand-primary transition-[width] duration-300 motion-reduce:transition-none rounded-full"
                    style={{ width: `${Math.min(fillPercent, 100)}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-text-secondary text-xs text-center py-6">Chưa có dữ liệu bán vé.</p>
        )}
      </div>
    </div>
  );
}

