import { EventStatus } from '../../../types';

interface EventStatusBadgeProps {
  status: EventStatus | string | number;
  isDeleted?: boolean;
}

export function EventStatusBadge({ status, isDeleted = false }: EventStatusBadgeProps) {
  if (isDeleted) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-surface-3 text-text-tertiary border border-border-subtle uppercase tracking-wider whitespace-nowrap shrink-0">
        Đã xóa
      </span>
    );
  }

  const normalizedStatus = String(status).toLowerCase();
  if (normalizedStatus === 'published' || normalizedStatus === '1') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success border border-success/30 whitespace-nowrap">Đang mở bán</span>;
  }
  if (normalizedStatus === 'draft' || normalizedStatus === '0') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-primary/15 text-brand-primary border border-brand-primary/30 whitespace-nowrap">Bản nháp</span>;
  }
  if (normalizedStatus === 'completed' || normalizedStatus === '2') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30 whitespace-nowrap">Đã kết thúc</span>;
  }
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-danger/15 text-danger border border-danger/30 whitespace-nowrap">Đã hủy</span>;
}
