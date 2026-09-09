import { useRef } from 'react';
import { AlertTriangle, Info, Loader2, X } from 'lucide-react';
import { useModalAccessibility } from './useModalAccessibility';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Xác Nhận',
  cancelText = 'Hủy',
  type = 'danger',
  isLoading = false,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useModalAccessibility(isOpen, isLoading, onClose, modalRef);

  if (!isOpen) return null;

  const isDanger = type === 'danger';
  const isWarning = type === 'warning';

  return (
    <div 
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div 
        ref={modalRef}
        className="bg-surface-1 border border-border-subtle p-6 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto overscroll-contain space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-200"
      >
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-full text-text-tertiary hover:text-white hover:bg-surface-2 transition-colors disabled:opacity-40"
          aria-label="Đóng"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div aria-hidden="true" className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isDanger 
              ? 'bg-danger/15 border-danger/30 text-danger' 
              : isWarning 
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' 
              : 'bg-brand-primary/15 border-brand-primary/30 text-brand-primary'
          }`}>
            {isDanger || isWarning ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </div>
          <div>
            <h3 id="confirm-modal-title" className="text-base font-bold text-white leading-tight">
              {title}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">Vui lòng xác nhận trước khi tiếp tục.</p>
          </div>
        </div>

        <div className="p-3.5 bg-surface-2/60 rounded-xl border border-border-subtle text-xs text-text-primary leading-relaxed" aria-live="polite">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>

        <div className="flex justify-end items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary border border-border-subtle disabled:opacity-40"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 ${
              isDanger
                ? 'bg-danger hover:bg-danger/90 text-white shadow-danger/20'
                : isWarning
                ? 'bg-amber-500 hover:bg-amber-600 text-black shadow-amber-500/20'
                : 'bg-brand-primary hover:bg-brand-primary/90 text-white shadow-brand-glow'
            }`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
