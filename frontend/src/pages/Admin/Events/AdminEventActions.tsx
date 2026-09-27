import { Edit2, Trash2, XCircle } from 'lucide-react';
import { Event } from '../../../types';

interface AdminEventActionsProps {
  event: Event;
  onEdit: (event: Event) => void;
  onCancel: (event: Event) => void;
  onDelete: (event: Event) => void;
  compact?: boolean;
}

export function AdminEventActions({ event, onEdit, onCancel, onDelete, compact = false }: AdminEventActionsProps) {
  const isCancelled = String(event.status) === '3' || String(event.status).toLowerCase() === 'cancelled';
  const isCompleted = String(event.status) === '2' || String(event.status).toLowerCase() === 'completed';

  if (compact) {
    return (
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
        <button onClick={() => onEdit(event)} disabled={event.isDeleted || isCompleted || isCancelled} className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-white rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary border border-border-subtle flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
          <Edit2 className="w-3.5 h-3.5" />Sửa
        </button>
        {!isCancelled && !isCompleted && (
          <button onClick={() => onCancel(event)} disabled={event.isDeleted} className="px-3 py-1.5 bg-amber-500/15 text-amber-400 hover:bg-amber-500 hover:text-black rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 border border-amber-500/30 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
            <XCircle className="w-3.5 h-3.5" />Hủy
          </button>
        )}
        <button onClick={() => onDelete(event)} disabled={event.isDeleted} className="px-3 py-1.5 bg-danger/15 text-danger hover:bg-danger hover:text-white rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger border border-danger/30 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
          <Trash2 className="w-3.5 h-3.5" />Xóa
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5 shrink-0">
      <button onClick={() => onEdit(event)} disabled={event.isDeleted || isCompleted || isCancelled} aria-label={`Chỉnh sửa sự kiện ${event.title}`} className="p-2 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white rounded-xl transition-colors border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed" title={isCancelled ? 'Không thể sửa sự kiện đã hủy' : isCompleted ? 'Không thể sửa sự kiện đã kết thúc' : 'Sửa sự kiện'}>
        <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      {!isCancelled && !isCompleted && (
        <button onClick={() => onCancel(event)} aria-label={`Hủy sự kiện & Hoàn tiền vé ${event.title}`} className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl transition-colors border border-amber-500/20" title="Hủy sự kiện & Hoàn tiền vé">
          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
      <button onClick={() => onDelete(event)} disabled={event.isDeleted} aria-label={`Xóa sự kiện ${event.title}`} className="p-2 bg-danger/10 hover:bg-danger/20 text-danger rounded-xl transition-colors border border-danger/20" title="Xóa sự kiện">
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
