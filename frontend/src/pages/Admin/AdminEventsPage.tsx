import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { Event } from '../../types';
import api from '../../services/api';
import { EventFormValues } from '../../components/Admin/EventModal';
import { getDefaultEventEndDate } from '../../components/Admin/EventModal/eventModalSchemas';
import { formValueToEventStatus } from '../../utils/adminEventState';
import { AdminEventsFilterBar } from './Events/AdminEventsFilterBar';
import { AdminEventsTable } from './Events/AdminEventsTable';
import { AdminEventsSkeleton } from './Events/AdminEventsSkeleton';
import { adminEventsPagedResponseSchema } from '../../schemas/adminSchemas';
import { AdminEventsHeader } from './Events/AdminEventsHeader';
import { AdminEventModalState, AdminEventsModals } from './Events/AdminEventsModals';

export default function AdminEventsPage() {
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination & Server Search/Filter state
  const [searchQuery, setSearchQuery] = useState(() => urlSearchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const [statusFilter, setStatusFilter] = useState<string>(() => urlSearchParams.get('status') || 'All');
  const [categoryFilter, setCategoryFilter] = useState<string>(() => urlSearchParams.get('category') || 'All');
  const [page, setPage] = useState(() => Math.max(1, Number(urlSearchParams.get('page')) || 1));
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Debounced search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Modals state
  const [modalState, setModalState] = useState<AdminEventModalState>({
    form: { open: false, event: null },
    deleteTarget: null,
    cancelTarget: null
  });
  const requestRef = useRef<AbortController | null>(null);

  const fetchEvents = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      setLoading(true);
      setLoadError(false);
      const params: Record<string, string | number> = { page, pageSize };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (categoryFilter !== 'All') params.category = categoryFilter;
      if (statusFilter === 'Deleted') {
        params.deletedOnly = 'true';
      } else if (statusFilter !== 'All') {
        params.status = Number(statusFilter);
      }

      const res = await api.get('/api/events/admin-all', { params, signal: controller.signal });
      if (res.data?.success) {
        const parsed = adminEventsPagedResponseSchema.safeParse(res.data.data);
        if (parsed.success) {
          const data = parsed.data;
          setEvents(data.items as Event[]);
          setTotalPages(data.totalPages || 1);
          setTotalCount(data.totalCount || 0);
        } else {
          setLoadError(true);
          toast.error('Dữ liệu sự kiện từ máy chủ không đúng định dạng.');
        }
      } else {
        setLoadError(true);
        toast.error(res.data?.message || 'Không thể tải danh sách sự kiện.');
      }
    } catch (err: unknown) {
      if ((err as { name?: string; code?: string })?.name === 'CanceledError' || (err as { code?: string })?.code === 'ERR_CANCELED') return;
      setLoadError(true);
      toast.error('Lỗi khi kết nối tới máy chủ sự kiện.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [page, pageSize, debouncedSearch, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchEvents();
    return () => requestRef.current?.abort();
  }, [fetchEvents]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (debouncedSearch.trim()) nextParams.set('search', debouncedSearch.trim());
    if (statusFilter !== 'All') nextParams.set('status', statusFilter);
    if (categoryFilter !== 'All') nextParams.set('category', categoryFilter);
    if (page > 1) nextParams.set('page', String(page));
    setUrlSearchParams(nextParams, { replace: true });
  }, [debouncedSearch, statusFilter, categoryFilter, page, setUrlSearchParams]);

  const handleOpenCreateModal = () => {
    setModalState(current => ({ ...current, form: { open: true, event: null } }));
  };

  const handleOpenEditModal = (event: Event) => {
    setModalState(current => ({ ...current, form: { open: true, event } }));
  };

  const handleModalSubmit = async (data: EventFormValues) => {
    setIsSubmitting(true);
    try {
      if (modalState.form.event) {
        const payload = {
          id: modalState.form.event.id,
          title: data.title,
          description: data.description,
          date: data.date,
          endDate: data.endDate || getDefaultEventEndDate(data.date).toISOString(),
          location: data.location,
          venueName: data.venueName || data.location,
          totalSeats: modalState.form.event.totalSeats,
          category: data.category,
          imageUrl: data.imageUrl,
          bannerUrl: data.imageUrl,
          organizerName: modalState.form.event.organizerName || 'TickeX Live',
          basePrice: data.basePrice || modalState.form.event.basePrice || 200000,
          status: formValueToEventStatus(data.status),
          refundCutoffHours: modalState.form.event.refundCutoffHours || 24,
          expectedVersion: modalState.form.event.version
        };

        const response = await api.put(`/api/events/${modalState.form.event.id}`, payload);
        if (response.data.success) {
          toast.success('Cập nhật sự kiện thành công');
          await fetchEvents();
          setModalState(current => ({ ...current, form: { ...current.form, open: false } }));
        } else {
          toast.error(response.data.message || 'Không thể cập nhật sự kiện.');
        }
      } else {
        const payload = {
          title: data.title,
          description: data.description,
          date: data.date,
          endDate: data.endDate || getDefaultEventEndDate(data.date).toISOString(),
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
          setModalState(current => ({ ...current, form: { ...current.form, open: false } }));
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
    if (!modalState.deleteTarget) return;
    setIsSubmitting(true);
    try {
      const res = await api.delete(`/api/events/${modalState.deleteTarget.id}`);
      if (res.data.success) {
        toast.success(`Đã xóa sự kiện "${modalState.deleteTarget.title}"`);
        setModalState(current => ({ ...current, deleteTarget: null }));
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
    if (!modalState.cancelTarget) return;
    setIsSubmitting(true);
    try {
      const res = await api.post(`/api/events/${modalState.cancelTarget.id}/cancel`, {
        reason,
        expectedVersion: modalState.cancelTarget.version,
      });
      if (res.data.success) {
        toast.success(`Đã hủy sự kiện "${modalState.cancelTarget.title}". Các vé đã bán đang chờ xử lý hoàn tiền.`);
        setModalState(current => ({ ...current, cancelTarget: null }));
        await fetchEvents();
      } else {
        toast.error(res.data.message || 'Không thể hủy sự kiện.');
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { code?: string; message?: string } } };
      if (apiErr.response?.status === 409 || apiErr.response?.data?.code === 'EVENT_CONCURRENCY_CONFLICT') {
        toast.error('Sự kiện vừa được chỉnh sửa bởi quản trị viên khác. Vui lòng tải lại dữ liệu.');
        await fetchEvents();
      } else {
        toast.error(apiErr.response?.data?.message || 'Không thể hủy sự kiện.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8 animate-in fade-in duration-500">
      <AdminEventsHeader onCreate={handleOpenCreateModal} />

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
          onCancel={event => setModalState(current => ({ ...current, cancelTarget: event }))}
          onDelete={event => setModalState(current => ({ ...current, deleteTarget: event }))}
        />
      )}

      <AdminEventsModals
        state={modalState}
        isSubmitting={isSubmitting}
        actions={{
          closeForm: () => setModalState(current => ({ ...current, form: { ...current.form, open: false } })),
          submitForm: handleModalSubmit,
          closeDelete: () => setModalState(current => ({ ...current, deleteTarget: null })),
          confirmDelete: handleConfirmDeleteEvent,
          closeCancel: () => setModalState(current => ({ ...current, cancelTarget: null })),
          confirmCancel: handleConfirmCancelEvent
        }}
      />
    </div>
  );
}
