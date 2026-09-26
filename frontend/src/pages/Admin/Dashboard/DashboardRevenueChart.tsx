import { BarChart3 } from 'lucide-react';
import { DailyRevenue } from './types';

interface DashboardRevenueChartProps {
  dailyStats: DailyRevenue[];
}

export function DashboardRevenueChart({ dailyStats }: DashboardRevenueChartProps) {
  const numberFormatter = new Intl.NumberFormat('vi-VN');
  const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
  const chartDateFormatter = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });
  const chartDayFormatter = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'UTC' });

  const maxDailyRevenue = Math.max(...dailyStats.map(d => d.revenue), 1);
  const total7DayRevenue = dailyStats.reduce((sum, d) => sum + d.revenue, 0);
  const total7DayTickets = dailyStats.reduce((sum, d) => sum + d.ticketsSold, 0);

  return (
    <div className="surface-panel p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-primary" />
            Doanh Thu 7 Ngày Gần Nhất
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">Biểu đồ doanh thu thực tế theo ngày thanh toán vé</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <span className="text-text-secondary block">Tổng 7 ngày:</span>
            <span className="font-bold text-emerald-400 font-display text-sm">
              {currencyFormatter.format(total7DayRevenue)}
            </span>
          </div>
          <div className="text-right border-l border-border-subtle pl-4">
            <span className="text-text-secondary block">Vé bán:</span>
            <span className="font-bold text-brand-readable font-display text-sm">
              {numberFormatter.format(total7DayTickets)} vé
            </span>
          </div>
        </div>
      </div>

      {/* Responsive Bar Chart */}
      <div className="pt-6 pb-2">
        {dailyStats.length === 0 ? (
          <p className="py-12 text-center text-sm text-text-secondary">Chưa có doanh thu trong 7 ngày gần nhất.</p>
        ) : (
          <div role="img" aria-label={`Biểu đồ doanh thu 7 ngày, tổng ${currencyFormatter.format(total7DayRevenue)} và ${numberFormatter.format(total7DayTickets)} vé`} className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-48 sm:h-56 px-2">
            {dailyStats.map((item, idx) => {
              const heightPercent = maxDailyRevenue > 0 ? Math.round((item.revenue / maxDailyRevenue) * 100) : 0;
              const dateObj = new Date(`${item.date}T00:00:00Z`);
              const formattedDate = chartDateFormatter.format(dateObj);
              const dayName = chartDayFormatter.format(dateObj);

              return (
                <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 pointer-events-none bg-surface-1 border border-border-subtle shadow-xl px-2.5 py-1.5 rounded-lg text-center whitespace-nowrap">
                    <p className="text-[11px] font-bold text-white">{currencyFormatter.format(item.revenue)}</p>
                    <p className="text-[10px] text-text-secondary">{numberFormatter.format(item.ticketsSold)} vé ({item.date})</p>
                  </div>

                  <div className="w-full max-w-[48px] bg-surface-3/50 rounded-t-xl overflow-hidden flex flex-col justify-end p-0.5 h-full">
                    <div 
                      className="w-full bg-brand-primary rounded-t-lg transition-[height] duration-300 motion-reduce:transition-none"
                      style={{ height: `${Math.max(heightPercent, 4)}%` }}
                    />
                  </div>

                  <div className="text-center mt-2">
                    <span className="text-[11px] font-bold text-white block">{formattedDate}</span>
                    <span className="text-[10px] text-text-tertiary block">{dayName}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {dailyStats.length > 0 && (
        <details className="rounded-lg border border-border-subtle bg-surface-1 px-4 py-3 text-sm text-text-secondary">
          <summary className="cursor-pointer font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">Xem dữ liệu chi tiết</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left">
              <caption>Chi tiết doanh thu 7 ngày gần nhất</caption>
              <thead>
                <tr><th scope="col">Ngày</th><th scope="col">Doanh thu</th><th scope="col">Vé bán</th></tr>
              </thead>
              <tbody>
                {dailyStats.map(item => (
                  <tr key={`accessible-${item.date}`}>
                    <td>{item.date}</td>
                    <td>{currencyFormatter.format(item.revenue)}</td>
                    <td>{numberFormatter.format(item.ticketsSold)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

