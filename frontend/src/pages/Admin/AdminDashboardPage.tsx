import { useState, useEffect, useRef, useCallback } from 'react';
import { TrendingUp, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { Stats } from './Dashboard/types';
import { adminDashboardStatsSchema } from '../../schemas/adminSchemas';
import { DashboardKpiGrid } from './Dashboard/DashboardKpiGrid';
import { DashboardRevenueChart } from './Dashboard/DashboardRevenueChart';
import { DashboardTopEvents } from './Dashboard/DashboardTopEvents';
import { DashboardRecentTransactions } from './Dashboard/DashboardRecentTransactions';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const hasLoadedStatsRef = useRef(false);

  const dateTimeFormatter = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

  const fetchStats = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      if (!hasLoadedStatsRef.current) setLoading(true);
      else setIsRefreshing(true);
      setError(false);
      const response = await api.get('/api/admin/stats', { signal: controller.signal });
      if (response.data?.success) {
        const parsed = adminDashboardStatsSchema.safeParse(response.data.data);
        if (parsed.success) {
          setStats(parsed.data as Stats);
          hasLoadedStatsRef.current = true;
          setLastUpdated(new Date());
        } else {
          setError(true);
          toast.error('Dữ liệu thống kê bảng điều khiển không đúng định dạng.');
        }
      } else {
        setError(true);
      }
    } catch (err: unknown) {
      if ((err as { code?: string })?.code === 'ERR_CANCELED') return;
      setError(true);
      toast.error('Không thể tải dữ liệu thống kê bảng điều khiển');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchStats();
    return () => requestRef.current?.abort();
  }, [fetchStats]);

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
        <button type="button" onClick={fetchStats} className="px-4 py-2 rounded-xl bg-brand-primary text-surface-0 font-bold focus-visible:ring-2 focus-visible:ring-white">Thử lại</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 text-text-primary animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="surface-panel flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 sm:p-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-primary/15 border border-brand-primary/30 w-fit mb-1.5 text-xs font-bold text-brand-readable">
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
      <DashboardKpiGrid stats={stats} />

      {/* 7-Day Revenue Chart Section */}
      <DashboardRevenueChart dailyStats={stats.dailyStats || []} />

      {/* Analytics & Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <DashboardTopEvents topEvents={stats.topEvents} />
        <DashboardRecentTransactions recentTransactions={stats.recentTransactions} />
      </div>
    </div>
  );
}
