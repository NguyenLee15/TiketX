import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Loader2, Plus, Edit2, Trash2, Calendar as CalendarIcon, 
  MapPin, Search, ChevronLeft, ChevronRight, XCircle, Grid3X3, Clock
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { Event, EventStatus } from '../../types';
import api from '../../services/api';
import EventModal, { EventFormValues } from '../../components/Admin/EventModal';
import ConfirmModal from '../../components/Admin/ConfirmModal';
import CancelEventModal from '../../components/Admin/CancelEventModal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { formValueToEventStatus } from '../../utils/adminEventState';

export default function AdminEventsPage() {
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination & Server Search/Filter state
  const [searchQuery, setSearchQuery] = useState(() => urlSearchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<string>(() => urlSearchParams.get('status') || 'All');
  const [categoryFilter, setCategoryFilter] = useState<string>(() => urlSearchParams.get('category') || 'All');
  const [page, setPage] = useState(() => Math.max(1, Number(urlSearchParams.get('page')) || 1));
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [deleteEventTarget, setDeleteEventTarget] = useState<Event | null>(null);
  const [cancelEventTarget, setCancelEventTarget] = useState<Event | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  const fetchEvents = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      setLoading(true);
      setLoadError(false);
      const params: Record<string, string | number> = {
        page,
        pageSize
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (categoryFilter !== 'All') params.category = categoryFilter;
      if (statusFilter === 'Deleted') {
        params.deletedOnly = 'true';
      } else if (statusFilter !== 'All') {
        params.status = Number(statusFilter);
      }

      const res = await api.get('/api/events/admin-all', { params, signal: controller.signal });
      if (res.data.success) {
        const data = res.data.data;
        if (data && data.items) {
          setEvents(data.items);
          setTotalCount(data.totalCount || 0);
          setTotalPages(data.totalPages || 1);
        } else if (Array.isArray(data)) {
          setEvents(data);
          setTotalCount(data.length);
          setTotalPages(1);
        }
      }
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === 'ERR_CANCELED') return;
      setLoadError(true);
      toast.error('Không thể tải danh sách sự kiện');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, categoryFilter, statusFilter]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEvents();
    }, 300);
    return () => { clearTimeout(timer); requestRef.current?.abort(); };
  }, [fetchEvents]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (searchQuery.trim()) nextParams.set('search', searchQuery.trim());
    if (categoryFilter !== 'All') nextParams.set('category', categoryFilter);
    if (statusFilter !== 'All') nextParams.set('status', statusFilter);
    if (page > 1) nextParams.set('page', String(page));
    setUrlSearchParams(nextParams, { replace: true });
  }, [categoryFilter, page, searchQuery, setUrlSearchParams, statusFilter]);

  const handleOpenCreateModal = () => {
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (data: EventFormValues) => {
    setIsSubmitting(true);
    try {
      if (selectedEvent) {
        // Edit event
          const payload = {
          id: selectedEvent.id,
          title: data.title,
          description: data.description,
          date: data.date,
          endDate: data.endDate || new Date(new Date(data.date).getTime() + 3 * 3600 * 1000).toISOString(),
          location: data.location,
          venueName: data.venueName || data.location,
          totalSeats: selectedEvent.totalSeats,
          category: data.category,
          imageUrl: data.imageUrl,
          bannerUrl: data.imageUrl,
          organizerName: selectedEvent.organizerName || 'TickeX Live',
          basePrice: data.basePrice || selectedEvent.basePrice || 200000,
          status: formValueToEventStatus(data.status),
          refundCutoffHours: selectedEvent.refundCutoffHours || 24
        };

        const response = await api.put(`/api/events/${selectedEvent.id}`, payload);
        if (response.data.success) {
          toast.success('Cập nhật sự kiện thành công');
          await fetchEvents();
          setIsModalOpen(false);
        } else {
          toast.error(response.data.message || 'Không thể cập nhật sự kiện. Vui lòng kiểm tra lại thông tin.');
        }
      } else {
        // Create event with seat matrix
        const payload = {
          title: data.title,
          description: data.description,
          date: data.date,
          endDate: data.endDate || new Date(new Date(data.date).getTime() + 3 * 3600 * 1000).toISOString(),
          location: data.location,
          venueName: data.venueName || data.location,
          totalSeats: data.rowCount * data.seatsPerRow,
          category: data.category,
          imageUrl: data.imageUrl,
          bannerUrl: data.imageUrl,
          organizerName: 'TickeX Live',
          basePrice: data.basePrice || 200000,
          refundCutoffHours: 24,
          rowCount: data.rowCount,
          seatsPerRow: data.seatsPerRow,
          status: formValueToEventStatus(data.status)
        };

        const response = await api.post('/api/events', payload);
        if (response.data.success) {
          toast.success('Tạo sự kiện và khởi tạo ma trận ghế thành công!');
          await fetchEvents();
          setIsModalOpen(false);
        } else {
          toast.error(response.data.message || 'Không thể tạo sự kiện. Vui lòng kiểm tra lại thông tin.');
        }
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Thao tác thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteEvent = async () => {
    if (!deleteEventTarget) return;
    setIsSubmitting(true);
    try {
      const res = await api.delete(`/api/events/${deleteEventTarget.id}`);
      if (res.data.success) {
        toast.success(`Đã xóa sự kiện "${deleteEventTarget.title}"`);
        setDeleteEventTarget(null);
        await fetchEvents();
      } else {
        toast.error(res.data.message || 'Không thể xóa sự kiện. Vui lòng thử lại.');
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Không thể xóa sự kiện. Sự kiện đã có vé hoặc dữ liệu liên quan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCancelEvent = async (reason: string) => {
    if (!cancelEventTarget) return;
    setIsSubmitting(true);
    try {
      const res = await api.post(`/api/events/${cancelEventTarget.id}/cancel`, { reason });
      if (res.data.success) {
        toast.success(`Đã hủy sự kiện "${cancelEventTarget.title}". Các vé đã thanh toán đang chờ xử lý hoàn tiền.`);
        setCancelEventTarget(null);
        await fetchEvents();
      } else {
        toast.error(res.data.message || 'Không thể hủy sự kiện. Vui lòng thử lại.');
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Không thể hủy sự kiện.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: EventStatus | string | number, isDeleted = false) => {
    if (isDeleted) {
      return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-surface-3 text-text-tertiary border border-border-subtle uppercase tracking-wider whitespace-nowrap shrink-0">Đã xóa</span>;
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
    <div className="space-y-6 max-w-7xl mx-auto pb-8 animate-in fade-in duration-500">
      {/* Top Header & Actions */}
      <div className="surface-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Quản Lý Sự Kiện & Sơ Đồ Ghế</h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
            Quản trị danh mục sự kiện, kiểm soát trạng thái phát hành và khởi tạo ma trận ghế tự động.
          </p>
        </div>
        <button 
          onClick={handleOpenCreateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary shadow-md shadow-brand-glow text-xs sm:text-sm shrink-0 active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo Sự Kiện Mới</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="surface-panel p-3.5 sm:p-4 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative flex items-center bg-surface-2 rounded-xl border border-border-subtle focus-within:border-brand-primary/50">
          <Search className="absolute left-3.5 w-4 h-4 text-text-tertiary" />
          <input 
            type="text" 
            placeholder="Tìm kiếm theo tên sự kiện, địa điểm..." 
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
            aria-label="Tìm kiếm sự kiện"
            className="w-full bg-transparent pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          />
        </div>

        <div className="flex gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
            aria-label="Lọc theo thể loại"
            className="bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs sm:text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary cursor-pointer whitespace-nowrap flex-1 sm:flex-initial"
          >
            <option value="All">Tất cả thể loại</option>
            <option value="Concert">Nhạc hội (Concert)</option>
            <option value="Music">Âm nhạc (Music)</option>
            <option value="Conference">Hội nghị (Conference)</option>
            <option value="Entertainment">Giải trí (Entertainment)</option>
            <option value="Sports">Thể thao (Sports)</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            aria-label="Lọc theo trạng thái"
            className="bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs sm:text-sm text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary cursor-pointer whitespace-nowrap flex-1 sm:flex-initial"
          >
            <option value="All">Tất cả trạng thái</option>
            <option value="1">Đang mở bán (Published)</option>
            <option value="0">Bản nháp (Draft)</option>
            <option value="2">Đã kết thúc (Completed)</option>
          <option value="3">Đã hủy (Cancelled)</option>
          <option value="Deleted">Đã xóa (Deleted)</option>
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {loadError && !loading && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">
          <span>Không thể tải danh sách sự kiện.</span>
          <button type="button" onClick={fetchEvents} className="rounded-lg border border-danger/30 px-3 py-1.5 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">Thử lại</button>
        </div>
      )}
      {loading ? (
        <div className="flex h-80 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : (
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
                              {/* Edit Button */}
                              <button
                                onClick={() => handleOpenEditModal(event)}
                                disabled={event.isDeleted}
                                className="p-2 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white rounded-xl transition-colors border border-border-subtle"
                                title="Sửa sự kiện"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Cancel Event Button */}
                              {!isCancelled && !isCompleted && (
                                <button
                                  onClick={() => setCancelEventTarget(event)}
                                  className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl transition-colors border border-amber-500/20"
                                  title="Hủy sự kiện & Hoàn tiền vé"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete Event Button */}
                              <button
                                onClick={() => setDeleteEventTarget(event)}
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
                      onClick={() => handleOpenEditModal(event)}
                      disabled={event.isDeleted}
                      className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 text-white rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary border border-border-subtle flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Sửa
                    </button>

                    {!isCancelled && !isCompleted && (
                      <button
                        onClick={() => setCancelEventTarget(event)}
                        disabled={event.isDeleted}
                        className="px-3 py-1.5 bg-amber-500/15 text-amber-400 hover:bg-amber-500 hover:text-black rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 border border-amber-500/30 flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Hủy
                      </button>
                    )}

                    <button
                      onClick={() => setDeleteEventTarget(event)}
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
                onClick={() => setPage(p => Math.max(1, p - 1))}
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
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-white border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                title="Trang sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal Create / Edit */}
      <EventModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        event={selectedEvent}
        isLoading={isSubmitting}
      />

      {/* Custom Confirm Deletion Modal */}
      <ConfirmModal 
        isOpen={!!deleteEventTarget}
        onClose={() => setDeleteEventTarget(null)}
        onConfirm={handleConfirmDeleteEvent}
        title="Xóa Sự Kiện Khỏi Hệ Thống"
        message={
          <div>
            <p>
              Bạn có chắc chắn muốn xóa sự kiện <span className="font-bold text-white">"{deleteEventTarget?.title}"</span> không?
            </p>
            <p className="mt-1.5 text-danger text-[11px]">
              Lưu ý: Hệ thống chỉ cho phép xóa những sự kiện chưa phát sinh bất kỳ chứng từ hoặc vé bán ra (Paid / Used / Cancelled).
            </p>
          </div>
        }
        confirmText="Xóa Sự Kiện"
        type="danger"
        isLoading={isSubmitting}
      />

      {/* Custom Cancel Event Modal */}
      <CancelEventModal 
        isOpen={!!cancelEventTarget}
        onClose={() => setCancelEventTarget(null)}
        onConfirm={handleConfirmCancelEvent}
        eventTitle={cancelEventTarget?.title || ''}
        isLoading={isSubmitting}
      />
    </div>
  );
}
