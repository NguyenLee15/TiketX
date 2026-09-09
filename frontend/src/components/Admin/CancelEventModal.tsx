import { useState, useEffect, useRef } from 'react';
import { AlertOctagon, Loader2, X } from 'lucide-react';
import { useModalAccessibility } from './useModalAccessibility';

interface CancelEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  eventTitle: string;
  isLoading?: boolean;
}

export default function CancelEventModal({
  isOpen,
  onClose,
  onConfirm,
  eventTitle,
  isLoading = false,
}: CancelEventModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useModalAccessibility(isOpen, isLoading, onClose, modalRef);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError('');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setError('Vui lòng nhập lý do hủy chi tiết (tối thiểu 5 ký tự).');
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-event-title"
    >
      <div ref={modalRef} className="bg-surface-1 border border-border-subtle p-6 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto overscroll-contain space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-full text-text-tertiary hover:text-white hover:bg-surface-2 transition-colors disabled:opacity-40"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-danger/15 border border-danger/30 flex items-center justify-center text-danger shrink-0">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <h3 id="cancel-event-title" className="text-base font-bold text-white leading-tight">
              Hủy Sự Kiện & Hoàn Tiền Vé
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">Thao tác này sẽ chuyển sự kiện sang trạng thái Đã Hủy.</p>
          </div>
        </div>

        <div className="p-3.5 bg-danger/10 border border-danger/20 rounded-xl text-xs text-danger-300 space-y-1">
          <p className="font-bold text-danger">Cảnh báo tác động nghiệp vụ:</p>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-text-secondary">
            <li>Sự kiện: <span className="text-white font-semibold">"{eventTitle}"</span></li>
            <li>Vé đã thanh toán sẽ chuyển sang <span className="text-white font-semibold">Đang chờ hoàn tiền</span>; provider sẽ xác nhận từng yêu cầu.</li>
            <li>Ghế chưa bán sẽ được mở lại. Ghế đã bán vẫn được giữ cho tới khi provider xác nhận hoàn tiền.</li>
            <li>Hành động được lưu vào Audit Log và có thể cần thời gian xử lý.</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="cancel-event-reason" className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">
              Lý do hủy sự kiện <span className="text-danger">*</span>
            </label>
            <textarea
              id="cancel-event-reason"
              name="reason"
              ref={inputRef}
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              placeholder="VD: Điều kiện thời tiết bất khả kháng hoặc kế hoạch của ban tổ chức thay đổi..."
              disabled={isLoading}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'cancel-event-reason-error' : undefined}
              className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-danger focus:border-danger/60 transition-colors resize-none disabled:opacity-50"
            />
            {error && <p id="cancel-event-reason-error" role="alert" className="text-danger text-[11px] mt-1">{error}</p>}
          </div>

          <div className="flex justify-end items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary border border-border-subtle disabled:opacity-40"
            >
              Quay Lại
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-danger hover:bg-danger/90 text-white rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger shadow-md shadow-danger/20 flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Xác Nhận Hủy Sự Kiện
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
