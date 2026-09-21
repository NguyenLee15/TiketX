import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Loader2 } from 'lucide-react';
import { Event } from '../../types';
import { useModalAccessibility } from './useModalAccessibility';
import { eventStatusToFormValue } from '../../utils/adminEventState';
import { 
  eventSchema, 
  EventFormValues, 
  CATEGORIES, 
  toLocalDatetimeInput, 
  toUtcIsoString 
} from './EventModal/eventModalSchemas';
import { EventSeatMatrixSection } from './EventModal/EventSeatMatrixSection';
import { EventImagePreviewSection } from './EventModal/EventImagePreviewSection';

export { toLocalDatetimeInput, toUtcIsoString, eventSchema, CATEGORIES };
export type { EventFormValues };

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EventFormValues) => Promise<void>;
  event?: Event | null;
  isLoading?: boolean;
}

export default function EventModal({ isOpen, onClose, onSubmit, event, isLoading }: EventModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalAccessibility(isOpen, Boolean(isLoading), onClose, modalRef);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      description: '',
      location: '',
      venueName: '',
      date: '',
      endDate: '',
      imageUrl: '',
      category: 'Concert',
      status: 'Published',
      rowCount: 5,
      seatsPerRow: 12,
      basePrice: 100000,
    }
  });

  const watchedImageUrl = watch('imageUrl');
  const watchedStatus = watch('status');
  const watchedRowCount = watch('rowCount') || 5;
  const watchedSeatsPerRow = watch('seatsPerRow') || 12;
  const totalMatrixSeats = watchedRowCount * watchedSeatsPerRow;
  const hasTicketHistory = Boolean(event?.hasTicketHistory);

  useEffect(() => {
    if (event) {
      const statusStr = eventStatusToFormValue(event.status);
      const defaultEndDate = event.date 
        ? new Date(new Date(event.date).getTime() + 3 * 3600 * 1000).toISOString() 
        : '';

      reset({
        title: event.title,
        description: event.description,
        location: event.location,
        venueName: event.venueName || event.location,
        date: toLocalDatetimeInput(event.date),
        endDate: toLocalDatetimeInput(event.endDate || defaultEndDate),
        imageUrl: event.imageUrl,
        category: event.category || 'Concert',
        status: statusStr,
        rowCount: 5,
        seatsPerRow: 12,
        basePrice: Number(event.basePrice) || 100000,
      });
    } else {
      reset({
        title: '',
        description: '',
        location: '',
        venueName: '',
        date: '',
        endDate: '',
        imageUrl: '',
        category: 'Concert',
        status: 'Published',
        rowCount: 5,
        seatsPerRow: 12,
        basePrice: 100000,
      });
    }
  }, [event, reset, isOpen]);

  if (!isOpen) return null;

  const onFormSubmit = async (data: EventFormValues) => {
    const transformed: EventFormValues = {
      ...data,
      date: toUtcIsoString(data.date),
      endDate: data.endDate ? toUtcIsoString(data.endDate) : toUtcIsoString(new Date(new Date(data.date).getTime() + 3 * 3600 * 1000).toISOString()),
    };
    await onSubmit(transformed);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-surface-1/95 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
    >
      <div 
        ref={modalRef}
        className="surface-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain p-6 sm:p-7 shadow-2xl relative animate-in zoom-in-95 duration-300 z-10"
      >
        <button 
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-5 right-5 p-1.5 bg-surface-2 hover:bg-surface-3 rounded-full text-text-secondary hover:text-white transition-colors disabled:opacity-40"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 id="event-modal-title" className="text-xl sm:text-2xl font-bold text-white mb-5">
          {event ? 'Chỉnh Sửa Sự Kiện' : 'Tạo Sự Kiện Mới & Thiết Lập Ghế'}
        </h2>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-3.5">
            <div>
              <label htmlFor="event-title" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
                Tên sự kiện <span className="text-danger">*</span>
              </label>
              <input 
                id="event-title"
                {...register('title')}
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? 'event-title-error' : undefined}
                className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary/50 transition-colors"
                placeholder="Ví dụ: Đại Nhạc Hội Mùa Hè 2026"
              />
              {errors.title && <p id="event-title-error" role="alert" className="text-danger text-xs mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label htmlFor="event-description" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
                Mô tả sự kiện <span className="text-danger">*</span>
              </label>
              <textarea 
                id="event-description"
                {...register('description')}
                rows={2}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? 'event-description-error' : undefined}
                className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary/50 transition-colors resize-none"
                placeholder="Mô tả chi tiết nội dung sự kiện, khách mời, lưu ý..."
              />
              {errors.description && <p id="event-description-error" role="alert" className="text-danger text-xs mt-1">{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="event-category" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">Thể loại</label>
                <select
                  id="event-category"
                  {...register('category')}
                  aria-label="Thể loại sự kiện"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary/50 transition-colors cursor-pointer"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat} className="bg-surface-1 text-white">{cat}</option>
                  ))}
                </select>
                {errors.category && <p className="text-danger text-xs mt-1">{errors.category.message}</p>}
              </div>

              <div>
                <label htmlFor="event-status" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">Trạng thái</label>
                <select
                  id="event-status"
                  {...register('status')}
                  disabled={watchedStatus === 'Completed' || isLoading}
                  aria-label="Trạng thái sự kiện"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary/50 transition-colors cursor-pointer"
                >
                  <option value="Published" className="bg-surface-1 text-white">Đang mở bán (Published)</option>
                  <option value="Draft" className="bg-surface-1 text-white">Bản nháp (Draft)</option>
                  {watchedStatus === 'Completed' && <option value="Completed" className="bg-surface-1 text-white">Đã kết thúc (Completed)</option>}
                  <option value="Cancelled" className="bg-surface-1 text-white">Đã hủy (Cancelled)</option>
                </select>
                {errors.status && <p className="text-danger text-xs mt-1">{errors.status.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="event-location" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
                  Địa điểm / Khán đài <span className="text-danger">*</span>
                </label>
                <input 
                  id="event-location"
                  {...register('location')}
                  aria-label="Địa điểm hoặc khán đài"
                  aria-invalid={Boolean(errors.location)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary/50 transition-colors"
                  placeholder="Ví dụ: Sân Vận Động Quốc Gia Mỹ Đình, Hà Nội"
                />
                {errors.location && <p className="text-danger text-xs mt-1">{errors.location.message}</p>}
              </div>

              <div>
                <label htmlFor="event-venue" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">Tên hội trường / Khán đài (Tùy chọn)</label>
                <input 
                  id="event-venue"
                  {...register('venueName')}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary/50 transition-colors"
                  placeholder="Ví dụ: Khán đài A - Tầng 2"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="event-date" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
                  Thời gian bắt đầu <span className="text-danger">*</span>
                </label>
                <input 
                  id="event-date"
                  type="datetime-local"
                  {...register('date')}
                  disabled={hasTicketHistory || isLoading}
                  aria-describedby={hasTicketHistory ? 'event-history-lock' : undefined}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary/50 transition-colors [color-scheme:dark] disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {errors.date && <p className="text-danger text-xs mt-1">{errors.date.message}</p>}
              </div>

              <div>
                <label htmlFor="event-end-date" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
                  Thời gian kết thúc (Dự kiến)
                </label>
                <input 
                  id="event-end-date"
                  type="datetime-local"
                  {...register('endDate')}
                  disabled={hasTicketHistory || isLoading}
                  aria-describedby={hasTicketHistory ? 'event-history-lock' : undefined}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary/50 transition-colors [color-scheme:dark] disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {errors.endDate && <p className="text-danger text-xs mt-1">{errors.endDate.message}</p>}
              </div>
            </div>

            {/* Matrix Seat Setup Section */}
            <EventSeatMatrixSection
              event={event}
              totalMatrixSeats={totalMatrixSeats}
              register={register}
              errors={errors}
            />

            {/* Cover Image & Live Preview Section */}
            <EventImagePreviewSection
              register={register}
              errors={errors}
              watchedImageUrl={watchedImageUrl}
            />
          </div>

          <div className="pt-3 border-t border-border-subtle space-y-2">
            <label htmlFor="event-base-price" className="block text-xs font-bold uppercase tracking-wider text-text-secondary">Giá vé cơ sở (VNĐ)</label>
            <input id="event-base-price" type="number" min={1} {...register('basePrice', { valueAsNumber: true })} disabled={isLoading} className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary" />
            {errors.basePrice && <p role="alert" className="text-danger text-xs">{errors.basePrice.message}</p>}
            <p className="text-[11px] text-text-secondary">Giá ghế được tạo tự động theo hạng: VIP 1,75×, Standard 1×, Economy 0,75×.</p>
          </div>

          <div className="pt-3 flex justify-end gap-2.5 border-t border-border-subtle">
            <button 
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white font-bold rounded-xl transition-colors border border-border-subtle text-xs sm:text-sm disabled:opacity-40"
            >
              Hủy
            </button>
            <button 
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary shadow-md shadow-brand-glow flex items-center gap-1.5 text-xs sm:text-sm active:scale-95 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {event ? 'Lưu Thay Đổi' : 'Tạo Sự Kiện & Khởi Tạo Ghế'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
