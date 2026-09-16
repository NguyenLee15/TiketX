import React from 'react';
import { 
  Edit2, Trash2, Calendar as CalendarIcon, MapPin, 
  ChevronLeft, ChevronRight, XCircle, Grid3X3, Clock 
} from 'lucide-react';
import { Event, EventStatus } from '../../../types';
import { formatCurrency, formatDate } from '../../../utils/formatters';

interface AdminEventsTableProps {
  events: Event[];
  totalCount: number;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onEdit: (event: Event) => void;
  onCancel: (event: Event) => void;
  onDelete: (event: Event) => void;
}

export const AdminEventsTable: React.FC<AdminEventsTableProps> = ({
  events,
  totalCount,
  page,
  totalPages,
  onPageChange,
  onEdit,
  onCancel,
  onDelete
}) => {
  const getStatusBadge = (status: EventStatus | string | number, isDeleted = false) => {
    if (isDeleted) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-surface-3 text-text-tertiary border border-border-subtle uppercase tracking-wider whitespace-nowrap shrink-0">
          Đã xóa
        </span>
      );
    }
    const s = String(status).toLowerCase();
    if (s === 'published' || s === '1') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/15 text-success border border-success/30 whitespace-nowrap">
          Đang mở bán
        </span>
      );
    }
    if (s === 'draft' || s === '0') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-primary/15 text-brand-primary border border-brand-primary/30 whitespace-nowrap">
          Bản nháp
        </span>
      );
    }
    if (s === 'completed' || s === '2') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30 whitespace-nowrap">
          Đã kết thúc
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-danger/15 text-danger border border-danger/30 whitespace-nowrap">
        Đã hủy
      </span>
    );
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block surface-panel overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-subtle bg-surface-2/30 text-[11px] font-bold text-text-tertiary uppercase tracking-wider">
                <th className="px-5 py-3.5 whitespace-nowrap">Sự Kiện</th>
                <th className="px-5 py-3.5 whitespace-nowrap">Trạng Thái</th>
                <th className="px-5 py-3.5 whitespace-nowrap">Giá Vé Cơ Bản</th>
                <th className="px-5 py-3.5 whitespace-nowrap">Thời Gian Diễn Ra</th>
                <th className="px-5 py-3.5 whitespace-nowrap">Địa Điểm</th>
                <th className="px-5 py-3.5 text-right whitespace-nowrap">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs sm:text-sm">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-secondary text-xs sm:text-sm">
                    Không tìm thấy sự kiện nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                events.map(event => {
                  const isCancelled = String(event.status) === '3' || String(event.status).toLowerCase() === 'cancelled';
                  const isCompleted = String(event.status) === '2' || String(event.status).toLowerCase() === 'completed';

                  return (
                    <tr key={event.id} className="hover:bg-surface-2/20 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <img 
                            src={event.imageUrl} 
                            alt={event.title} 
                            width="48"
                            height="48"
                            loading="lazy"
                            className="w-12 h-12 rounded-xl object-cover shrink-0 border border-border-subtle group-hover:border-brand-primary/40 transition-colors shadow-sm"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-white line-clamp-1 group-hover:text-brand-primary transition-colors">
                              {event.title}
                            </div>
                            <div className="text-[11px] text-text-secondary flex items-center gap-2 mt-0.5">
                              <span className="text-brand-primary font-medium whitespace-nowrap">{event.category}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1 whitespace-nowrap">
                                <Grid3X3 className="w-3 h-3 text-text-tertiary" />
                                {event.totalSeats} Ghế
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {getStatusBadge(event.status, event.isDeleted)}
                      </td>
                      <td className="px-5 py-3.5 font-bold text-white font-mono whitespace-nowrap">
                        {formatCurrency(event.basePrice)}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-text-secondary whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-white font-medium whitespace-nowrap">
                          <CalendarIcon className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                          <span>{formatDate(event.date, { dateStyle: 'medium' })}</span>
                          <span className="text-text-tertiary font-mono">{formatDate(event.date, { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {event.endDate && (
                          <div className="flex items-center gap-1 text-[10px] text-text-tertiary mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>Đến: {formatDate(event.endDate, { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-text-secondary">
                        <div className="flex items-center gap-1.5 text-white truncate max-w-xs">
                          <MapPin className="w-3.5 h-3.5 text-brand-secondary shrink-0" />
                          <span className="truncate">{event.venueName || event.location}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5 shrink-0">
                          <button
                            onClick={() => onEdit(event)}
                            disabled={event.isDeleted}
                            className="p-2 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white rounded-xl transition-colors border border-border-subtle"
                            title="Sửa sự kiện"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {!isCancelled && !isCompleted && (
                            <button
                              onClick={() => onCancel(event)}
                              className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl transition-colors border border-amber-500/20"
                              title="Hủy sự kiện & Hoàn tiền vé"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => onDelete(event)}
                            disabled={event.isDeleted}
                            className="p-2 bg-danger/10 hover:bg-danger/20 text-danger rounded-xl transition-colors border border-danger/20"
                            title="Xóa sự kiện"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View (< md) */}
      <div className="block md:hidden space-y-3.5">
        {events.map(event => {
          const isCancelled = String(event.status) === '3' || String(event.status).toLowerCase() === 'cancelled';
          const isCompleted = String(event.status) === '2' || String(event.status).toLowerCase() === 'completed';

          return (
            <div key={event.id} className="surface-panel p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img 
                    src={event.imageUrl} 
                    alt={event.title} 
                    width="48"
                    height="48"
                    loading="lazy"
                    className="w-12 h-12 rounded-xl object-cover shrink-0 border border-border-subtle"
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold text-white text-sm truncate">{event.title}</h3>
                    <p className="text-xs text-text-secondary">{event.category} • {event.totalSeats} Ghế</p>
                  </div>
                </div>
                {getStatusBadge(event.status, event.isDeleted)}
              </div>

              <div className="space-y-1.5 text-xs text-text-secondary pt-1 border-t border-border-subtle">
                <div className="flex items-center justify-between">
                  <span className="text-text-tertiary">Giá cơ bản:</span>
                  <span className="font-bold text-white font-mono">{formatCurrency(event.basePrice)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-tertiary">Thời gian:</span>
                  <span className="text-white">
                    {formatDate(event.date, { dateStyle: 'medium', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-tertiary">Địa điểm:</span>
                  <span className="text-white truncate max-w-[200px]">{event.venueName || event.location}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  onClick={() => onEdit(event)}
                  disabled={event.isDeleted}
                  className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-white rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary border border-border-subtle flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Sửa
                </button>

                {!isCancelled && !isCompleted && (
                  <button
                    onClick={() => onCancel(event)}
                    disabled={event.isDeleted}
                    className="px-3 py-1.5 bg-amber-500/15 text-amber-400 hover:bg-amber-500 hover:text-black rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 border border-amber-500/30 flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Hủy
                  </button>
                )}

                <button
                  onClick={() => onDelete(event)}
                  className="px-3 py-1.5 bg-danger/15 text-danger hover:bg-danger hover:text-white rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger border border-danger/30 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa
                </button>
              </div>
            </div>
          );
        })}

        {events.length === 0 && (
          <p className="p-8 text-center text-text-secondary text-xs">Không tìm thấy sự kiện nào.</p>
        )}
      </div>

      {/* Server-side Pagination Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-2 text-xs text-text-secondary">
        <p>
          Hiển thị <span className="font-bold text-white">{events.length}</span> / <span className="font-bold text-white">{totalCount}</span> sự kiện (Trang {page}/{totalPages})
        </p>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="p-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-white border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            title="Trang trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="px-3 py-1 rounded-xl bg-surface-2 border border-border-subtle text-white font-mono">
            {page}
          </span>

          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="p-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-white border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            title="Trang sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
};
