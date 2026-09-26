import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { Grid3X3, AlertCircle } from 'lucide-react';
import { Event } from '../../../types';
import { EventFormValues } from './eventModalSchemas';

interface EventSeatMatrixSectionProps {
  event?: Event | null;
  totalMatrixSeats: number;
  register: UseFormRegister<EventFormValues>;
  errors: FieldErrors<EventFormValues>;
}

export function EventSeatMatrixSection({ event, totalMatrixSeats, register, errors }: EventSeatMatrixSectionProps) {
  return (
    <div className="p-3.5 bg-surface-2/40 border border-border-subtle rounded-xl space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3X3 className="w-4 h-4 text-brand-primary" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Cấu hình Sơ Đồ Ma Trận Ghế</h4>
        </div>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-brand-primary/15 text-brand-primary border border-brand-primary/30">
          {event ? `${event.totalSeats} Ghế đã tạo` : `${totalMatrixSeats} Ghế dự kiến`}
        </span>
      </div>

      {event ? (
        <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface-2/50 p-2.5 rounded-lg border border-border-subtle">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span id="event-history-lock">
            Ma trận ghế đã được khởi tạo ({event.totalSeats} ghế). Sự kiện đã có lịch sử vé/đặt chỗ nên ngày, giá và ma trận được khóa để bảo đảm toàn vẹn dữ liệu.
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label htmlFor="event-row-count" className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
              Số hàng ghế (Rows A, B, C...)
            </label>
            <input 
              id="event-row-count"
              type="number"
              min={1}
              max={50}
              {...register('rowCount', { valueAsNumber: true })}
              aria-invalid={Boolean(errors.rowCount)}
              aria-describedby={errors.rowCount ? 'event-row-count-error' : undefined}
              className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary"
            />
            {errors.rowCount && <p id="event-row-count-error" role="alert" className="text-danger text-[10px] mt-0.5">{errors.rowCount.message}</p>}
          </div>

          <div>
            <label htmlFor="event-seats-per-row" className="block text-[11px] font-bold text-text-secondary uppercase mb-1">
              Số ghế mỗi hàng (Seats per row)
            </label>
            <input 
              id="event-seats-per-row"
              type="number"
              min={1}
              max={50}
              {...register('seatsPerRow', { valueAsNumber: true })}
              aria-invalid={Boolean(errors.seatsPerRow)}
              aria-describedby={errors.seatsPerRow ? 'event-seats-per-row-error' : undefined}
              className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary"
            />
            {errors.seatsPerRow && <p id="event-seats-per-row-error" role="alert" className="text-danger text-[10px] mt-0.5">{errors.seatsPerRow.message}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
