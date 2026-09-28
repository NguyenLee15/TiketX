import { Link } from 'react-router-dom';
import { RefreshCw, Ticket } from 'lucide-react';

interface AdminDashboardEmptyStateProps {
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function AdminDashboardEmptyState({ onRefresh, isRefreshing }: AdminDashboardEmptyStateProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      className="min-h-[40vh] flex flex-col items-center justify-center gap-4 text-center px-6"
    >
      <Ticket aria-hidden="true" className="w-10 h-10 text-brand-primary" />
      <div>
        <h1 className="text-xl font-bold text-white">Chưa có dữ liệu quản trị</h1>
        <p className="mt-2 text-sm text-text-secondary">Tạo sự kiện đầu tiên để bắt đầu theo dõi doanh thu và vé.</p>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/admin/events" className="px-4 py-2 rounded-xl bg-brand-primary text-white font-bold focus-visible:ring-2 focus-visible:ring-white">
          Tạo sự kiện
        </Link>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border-subtle text-text-secondary hover:text-white focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50"
        >
          <RefreshCw aria-hidden="true" className={`w-4 h-4 ${isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          Làm mới
        </button>
      </div>
    </section>
  );
}
