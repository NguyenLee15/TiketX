import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { Event } from '../../types';
import api from '../../services/api';
import EventModal, { EventFormValues } from '../../components/Admin/EventModal';
import ConfirmModal from '../../components/Admin/ConfirmModal';
import CancelEventModal from '../../components/Admin/CancelEventModal';
import { formValueToEventStatus } from '../../utils/adminEventState';
import { AdminEventsFilterBar } from './Events/AdminEventsFilterBar';
import { AdminEventsTable } from './Events/AdminEventsTable';
import { AdminEventsSkeleton } from './Events/AdminEventsSkeleton';

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
      const params: Record<string, string | number> = { page, pageSize };
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
        setEvents(data.items || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || 0);
      } else {
        setLoadError(true);
        toast.error(res.data.message || 'Không thể tải danh sách sự kiện.');
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === 'CanceledError') return;
      setLoadError(true);
      toast.error('Lỗi khi kết nối tới máy chủ sự kiện.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchEvents();
    return () => requestRef.current?.abort();
  }, [fetchEvents]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (searchQuery.trim()) nextParams.set('search', searchQuery.trim());
    if (statusFilter !== 'All') nextParams.set('status', statusFilter);
    if (categoryFilter !== 'All') nextParams.set('category', categoryFilter);
    if (page > 1) nextParams.set('page', String(page));
    setUrlSearchParams(nextParams, { replace: true });
  }, [searchQuery, statusFilter, categoryFilter, page, setUrlSearchParams]);

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
          refundCutoffHours: selectedEvent.refundCutoffHours || 24,
          expectedVersion: (selectedEvent as unknown as { version?: string })?.version
        };

        const response = await api.put(`/api/events/${selectedEvent.id}`, payload);
        if (response.data.success) {
          toast.success('Cập nhật sự kiện thành công');
          await fetchEvents();
          setIsModalOpen(false);
        } else {
          toast.error(response.data.message || 'Không thể cập nhật sự kiện.');
        }
      } else {
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
          toast.error(response.data.message || 'Không thể tạo sự kiện.');
        }
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { code?: string; message?: string } } };
      if (apiErr.response?.data?.code === 'EVENT_CONCURRENCY_CONFLICT' || apiErr.response?.status === 409) {
        toast.error('Sự kiện vừa được chỉnh sửa bởi quản trị viên khác. Đang tải lại dữ liệu...');
        await fetchEvents();
      } else {
        toast.error(apiErr.response?.data?.message || 'Thao tác thất bại');
      }
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
        toast.error(res.data.message || 'Không thể xóa sự kiện.');
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Không thể xóa sự kiện. Sự kiện đã có vé liên quan.');
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
        toast.success(`Đã hủy sự kiện "${cancelEventTarget.title}". Các vé đã bán đang chờ xử lý hoàn tiền.`);
        setCancelEventTarget(null);
        await fetchEvents();
      } else {
        toast.error(res.data.message || 'Không thể hủy sự kiện.');
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      toast.error(apiErr.response?.data?.message || 'Không thể hủy sự kiện.');
    } finally {
      setIsSubmitting(false);
    }
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
      <AdminEventsFilterBar
        searchQuery={searchQuery}
        onSearchChange={val => { setSearchQuery(val); setPage(1); }}
        categoryFilter={categoryFilter}
        onCategoryChange={val => { setCategoryFilter(val); setPage(1); }}
        statusFilter={statusFilter}
        onStatusChange={val => { setStatusFilter(val); setPage(1); }}
      />

      {/* Main Content Area */}
      {loadError && !loading && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-xs text-danger">
          <span>Không thể tải danh sách sự kiện.</span>
          <button type="button" onClick={fetchEvents} className="rounded-lg border border-danger/30 px-3 py-1.5 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">Thử lại</button>
        </div>
      )}

      {loading ? (
        <AdminEventsSkeleton />
      ) : (
        <AdminEventsTable
          events={events}
          totalCount={totalCount}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onEdit={handleOpenEditModal}
          onCancel={setCancelEventTarget}
          onDelete={setDeleteEventTarget}
        />
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
        title="Xóa vĩnh viễn sự kiện"
        message={`Bạn có chắc chắn muốn xóa sự kiện "${deleteEventTarget?.title}"? Hành động này sẽ chuyển trạng thái sự kiện sang Đã xóa.`}
        confirmText="Xác nhận xóa"
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
