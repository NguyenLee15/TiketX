import { useState, useEffect } from 'react';
import { 
  Users, Calendar, DollarSign, Activity, Ticket, 
  RotateCcw, CheckCircle2, TrendingUp, BarChart3, Clock, RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';

interface DailyRevenue {
  date: string;
  revenue: number;
  ticketsSold: number;
}

interface TopEvent {
  id: string;
  title: string;
  category: string;
  ticketsSold: number;
  revenue: number;
  totalSeats: number;
}

interface RecentTransaction {
  ticketId: string;
  orderCode: number;
  eventTitle: string;
  userName: string;
  amount: number;
  status: string;
  createdAt: string;
}

interface Stats {
  totalUsers: number;
  totalEvents: number;
  totalTicketsSold: number;
  totalRevenue: number;
  totalRefunded: number;
  totalRefundPending?: number;
  totalNetRevenue?: number;
  totalCheckedIn: number;
  topEvents: TopEvent[];
  recentTransactions: RecentTransaction[];
  dailyStats: DailyRevenue[];
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const numberFormatter = new Intl.NumberFormat('vi-VN');
  const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
  const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  const chartDateFormatter = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric', timeZone: 'UTC' });
  const chartDayFormatter = new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'UTC' });

  const fetchStats = async () => {
    try {
      if (!stats) setLoading(true);
      else setIsRefreshing(true);
      setError(false);
      const response = await api.get('/api/admin/stats');
      if (response.data.success) {
        setStats(response.data.data);
        setLastUpdated(new Date());
      } else {
        setError(true);
      }
    } catch (err) {
      console.error(err);
      setError(true);
      toast.error('Không thể tải dữ liệu thống kê bảng điều khiển');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 pb-8 animate-pulse max-w-7xl mx-auto">
        <div className="h-24 bg-surface-2/40 rounded-2xl border border-border-subtle" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-surface-2/40 rounded-2xl border border-border-subtle" />
          ))}
        </div>
        <div className="h-64 bg-surface-2/40 rounded-2xl border border-border-subtle" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 h-80 bg-surface-2/40 rounded-2xl border border-border-subtle" />
          <div className="lg:col-span-6 h-80 bg-surface-2/40 rounded-2xl border border-border-subtle" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div role="alert" className="min-h-[40vh] flex flex-col items-center justify-center gap-4 text-center">
        <p className="text-text-secondary">{error ? 'Không thể tải dữ liệu quản trị.' : 'Chưa có dữ liệu quản trị.'}</p>
        <button type="button" onClick={fetchStats} className="px-4 py-2 rounded-xl bg-brand-primary text-white font-bold focus-visible:ring-2 focus-visible:ring-white">Thử lại</button>
      </div>
    );
  }

  const attendanceRate = stats?.totalTicketsSold && stats.totalTicketsSold > 0
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
      glow: 'shadow-[0_0_30px_rgba(34,197,94,0.15)]'
    },
    {
      title: 'Vé Đã Bán Ra',
      value: `${numberFormatter.format(stats.totalTicketsSold || 0)} vé`,
      icon: Ticket,
      color: 'text-brand-primary',
      bg: 'bg-brand-primary/10',
      border: 'border-brand-primary/20',
      badge: 'Đã thanh toán',
      glow: 'shadow-brand-glow'
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
      glow: 'shadow-[0_0_30px_rgba(16,185,129,0.15)]'
    },
    {
      title: 'Tiền Đã Hoàn Trả',
      value: currencyFormatter.format(stats.totalRefunded || 0),
      icon: RotateCcw,
      color: 'text-warning',
      bg: 'bg-warning/10',
      border: 'border-warning/20',
      badge: 'Đã xử lý hoàn',
      glow: 'shadow-[0_0_30px_rgba(245,158,11,0.15)]'
    },
    {
      title: 'Đang Chờ Hoàn',
      value: currencyFormatter.format(stats.totalRefundPending || 0),
      icon: RotateCcw,
      color: 'text-amber-300',
      bg: 'bg-amber-400/10',
      border: 'border-amber-400/20',
      badge: 'Provider chưa xác nhận',
      glow: 'shadow-[0_0_30px_rgba(251,191,36,0.12)]'
    },
    {
      title: 'Doanh Thu Thuần',
      value: currencyFormatter.format(stats.totalNetRevenue ?? ((stats.totalRevenue || 0) - (stats.totalRefunded || 0))),
      icon: TrendingUp,
      color: 'text-emerald-300',
      bg: 'bg-emerald-400/10',
      border: 'border-emerald-400/20',
      badge: 'Gross trừ đã hoàn + đang chờ',
      glow: 'shadow-[0_0_30px_rgba(52,211,153,0.12)]'
    },
    {
      title: 'Tổng Số Sự Kiện',
      value: numberFormatter.format(stats.totalEvents || 0),
      icon: Calendar,
      color: 'text-blue-400',
      bg: 'bg-blue-400/10',
      border: 'border-blue-400/20',
      badge: 'Trên toàn hệ thống',
      glow: 'shadow-[0_0_30px_rgba(96,165,250,0.15)]'
    },
    {
      title: 'Người Dùng Đăng Ký',
      value: numberFormatter.format(stats.totalUsers || 0),
      icon: Users,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      border: 'border-purple-400/20',
       badge: 'Tài khoản trong hệ thống',
      glow: 'shadow-[0_0_30px_rgba(192,132,252,0.15)]'
    }
  ];

  // Daily revenue calculations
  const dailyStats = stats?.dailyStats || [];
  const maxDailyRevenue = Math.max(...dailyStats.map(d => d.revenue), 1);
  const total7DayRevenue = dailyStats.reduce((sum, d) => sum + d.revenue, 0);
  const total7DayTickets = dailyStats.reduce((sum, d) => sum + d.ticketsSold, 0);

  return (
    <div className="space-y-6 pb-8 text-text-primary animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-2/30 p-5 sm:p-6 rounded-2xl border border-border-subtle backdrop-blur-md">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-primary/15 border border-brand-primary/30 w-fit mb-1.5 text-xs font-bold text-brand-primary">
            <TrendingUp className="w-3.5 h-3.5" />
            Bảng Điều Khiển Quản Trị Hệ Thống
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
            Tổng Quan Doanh Thu & Soát Vé
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
            Tổng tiền vé đã thanh toán, tiền đã hoàn và hoạt động soát vé từ hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-text-tertiary bg-surface-2 px-3 py-1.5 rounded-xl border border-border-subtle">
          <Clock className="w-3.5 h-3.5 text-brand-primary" />
          <span aria-live="polite">Cập nhật: {lastUpdated ? dateTimeFormatter.format(lastUpdated) : '—'}</span>
          <button type="button" onClick={fetchStats} disabled={isRefreshing} aria-label="Làm mới dữ liệu bảng điều khiển" className="p-1 rounded-md hover:bg-surface-3 text-text-secondary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map((stat, idx) => (
          <div 
            key={idx}
            className={`glass-premium p-5 sm:p-6 rounded-2xl border border-border-subtle relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 ${stat.glow}`}
          >
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[50px] pointer-events-none opacity-40 ${stat.bg}`} />
            
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

      {/* 7-Day Revenue Chart Section */}
      <div className="glass-card p-5 sm:p-6 rounded-2xl border border-border-subtle space-y-4">
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
              <span className="font-bold text-brand-primary font-display text-sm">
                {numberFormatter.format(total7DayTickets)} vé
              </span>
            </div>
          </div>
        </div>

        {/* CSS/SVG Responsive Bar Chart */}
        <div className="pt-6 pb-2">
          {dailyStats.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-secondary">Chưa có doanh thu trong 7 ngày gần nhất.</p>
          ) : <div role="img" aria-label={`Biểu đồ doanh thu 7 ngày, tổng ${currencyFormatter.format(total7DayRevenue)} và ${numberFormatter.format(total7DayTickets)} vé`} className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-48 sm:h-56 px-2">
            {dailyStats.map((item, idx) => {
              const heightPercent = maxDailyRevenue > 0 ? Math.round((item.revenue / maxDailyRevenue) * 100) : 0;
              const dateObj = new Date(`${item.date}T00:00:00Z`);
              const formattedDate = chartDateFormatter.format(dateObj);
              const dayName = chartDayFormatter.format(dateObj);

              return (
                <div key={idx} className="flex flex-col items-center h-full justify-end group relative">
                  {/* Tooltip on Hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 pointer-events-none bg-surface-1 border border-border-subtle shadow-xl px-2.5 py-1.5 rounded-lg text-center whitespace-nowrap">
                    <p className="text-[11px] font-bold text-white">{currencyFormatter.format(item.revenue)}</p>
                    <p className="text-[10px] text-text-secondary">{numberFormatter.format(item.ticketsSold)} vé ({item.date})</p>
                  </div>

                  {/* Revenue Bar */}
                  <div className="w-full max-w-[48px] bg-surface-3/50 rounded-t-xl overflow-hidden flex flex-col justify-end p-0.5 h-full">
                    <div 
                      className="w-full bg-gradient-to-t from-brand-primary to-emerald-400 rounded-t-lg transition-[height,filter] duration-700 motion-reduce:transition-none group-hover:brightness-125 shadow-sm"
                      style={{ height: `${Math.max(heightPercent, 4)}%` }}
                    />
                  </div>

                  {/* Label */}
                  <div className="text-center mt-2">
                    <span className="text-[11px] font-bold text-white block">{formattedDate}</span>
                    <span className="text-[10px] text-text-tertiary block">{dayName}</span>
                  </div>
                </div>
              );
            })}
          </div>}
        </div>
      </div>

      {/* Analytics & Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Top Events Leaderboard (6 cols) */}
        <div className="lg:col-span-6 glass-card p-5 sm:p-6 rounded-2xl border border-border-subtle">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2 whitespace-nowrap">
            <Activity className="w-4 h-4 text-brand-primary" />
            Top Sự Kiện Bán Chạy Nhất
          </h2>

          <div className="space-y-3">
            {stats?.topEvents && stats.topEvents.length > 0 ? (
              stats.topEvents.map((evt) => {
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

                    {/* Occupancy Progress Bar */}
                    <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-[width] duration-500 motion-reduce:transition-none rounded-full"
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

        {/* Recent Transactions Stream (6 cols) */}
        <div className="lg:col-span-6 glass-card p-5 sm:p-6 rounded-2xl border border-border-subtle">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2 whitespace-nowrap">
            <DollarSign className="w-4 h-4 text-success" />
            Lịch Sử Giao Dịch Mới Nhất
          </h2>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
              stats.recentTransactions.map((tx) => (
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
      </div>
    </div>
  );
}
