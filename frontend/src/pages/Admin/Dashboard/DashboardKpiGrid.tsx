import { Users, Calendar, DollarSign, Ticket, RotateCcw, CheckCircle2, TrendingUp } from 'lucide-react';
import { Stats } from './types';

interface DashboardKpiGridProps {
  stats: Stats;
}

export function DashboardKpiGrid({ stats }: DashboardKpiGridProps) {
  const numberFormatter = new Intl.NumberFormat('vi-VN');
  const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

  const attendanceRate = stats.totalTicketsSold > 0
    ? Math.round((stats.totalCheckedIn / stats.totalTicketsSold) * 100)
    : 0;

  const statCards = [
    {
      title: 'Tổng Doanh Thu',
      value: currencyFormatter.format(stats.totalRevenue || 0),
      icon: DollarSign,
      color: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success/20',
      badge: 'Gross trước hoàn tiền',
    },
    {
      title: 'Vé Đã Bán Ra',
      value: `${numberFormatter.format(stats.totalTicketsSold || 0)} vé`,
      icon: Ticket,
      color: 'text-brand-primary',
      bg: 'bg-brand-primary/10',
      border: 'border-brand-primary/20',
      badge: 'Đã thanh toán',
    },
    {
      title: 'Tỷ Lệ Check-in',
      value: `${attendanceRate}%`,
      subtitle: `${numberFormatter.format(stats.totalCheckedIn || 0)} / ${numberFormatter.format(stats.totalTicketsSold || 0)} khách đã vào cổng`,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      badge: 'Trực tiếp tại cổng',
    },
    {
      title: 'Tiền Đã Hoàn Trả',
      value: currencyFormatter.format(stats.totalRefunded || 0),
      icon: RotateCcw,
      color: 'text-warning',
      bg: 'bg-warning/10',
      border: 'border-warning/20',
      badge: 'Đã xử lý hoàn',
    },
    {
      title: 'Đang Chờ Hoàn',
      value: currencyFormatter.format(stats.totalRefundPending || 0),
      icon: RotateCcw,
      color: 'text-amber-300',
      bg: 'bg-amber-400/10',
      border: 'border-amber-400/20',
      badge: 'Provider chưa xác nhận',
    },
    {
      title: 'Doanh Thu Thuần',
      value: currencyFormatter.format(stats.totalNetRevenue ?? ((stats.totalRevenue || 0) - (stats.totalRefunded || 0))),
      icon: TrendingUp,
      color: 'text-emerald-300',
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/20',
      badge: 'Gross trừ đã hoàn + đang chờ',
    },
    {
      title: 'Tổng Số Sự Kiện',
      value: numberFormatter.format(stats.totalEvents || 0),
      icon: Calendar,
      color: 'text-brand-primary',
      bg: 'bg-brand-primary/10',
      border: 'border-brand-primary/20',
      badge: 'Trên toàn hệ thống',
    },
    {
      title: 'Người Dùng Đăng Ký',
      value: numberFormatter.format(stats.totalUsers || 0),
      icon: Users,
      color: 'text-brand-primary',
      bg: 'bg-brand-primary/10',
      border: 'border-brand-primary/20',
      badge: 'Tài khoản trong hệ thống',
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {statCards.map((stat, idx) => (
        <div 
          key={idx}
          className="surface-panel p-5 sm:p-6 relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-200"
        >
          <div className="flex justify-between items-start mb-3 relative z-10 gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${stat.border} ${stat.bg} shrink-0`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <span className="flex items-center gap-1 text-[11px] font-bold text-text-secondary bg-surface-2/80 px-2.5 py-0.5 rounded-full border border-border-subtle whitespace-nowrap shrink-0">
              {stat.badge}
            </span>
          </div>
          
          <div className="relative z-10">
            <p className="text-xs text-text-secondary font-bold uppercase tracking-wider mb-0.5">{stat.title}</p>
            <p className="text-2xl lg:text-3xl font-display font-black text-white tracking-tight break-words">
              {stat.value}
            </p>
            {stat.subtitle && (
              <p className="text-[11px] text-text-tertiary mt-1 font-medium whitespace-nowrap">{stat.subtitle}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

