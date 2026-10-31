import React, { useRef } from 'react';
import { useModalAccessibility } from '../Admin/useModalAccessibility';

interface CheckoutReleaseDialogProps {
  isOpen: boolean;
  releasing: boolean;
  releaseError: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const CheckoutReleaseDialog: React.FC<CheckoutReleaseDialogProps> = React.memo(({
  isOpen,
  releasing,
  releaseError,
  onCancel,
  onConfirm,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalAccessibility(isOpen, releasing, onCancel, dialogRef);

  if (!isOpen) return null;

  return (
    <div 
      className="absolute inset-0 z-20 flex items-center justify-center bg-surface-1/95 p-5 animate-in fade-in duration-200" 
      role="alertdialog" 
      aria-modal="true" 
      aria-labelledby="release-confirm-title"
    >
      <div ref={dialogRef} className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface-2 p-5 shadow-2xl space-y-3">
        <h2 id="release-confirm-title" className="text-base font-bold text-white">
          Rời phiên thanh toán?
        </h2>
        <p className="text-xs leading-relaxed text-text-secondary">
          Ghế sẽ được trả lại để người khác có thể đặt, và liên kết thanh toán hiện tại sẽ bị hủy.
        </p>
        
        {releaseError && (
          <p role="alert" aria-live="polite" className="text-xs text-danger">
            {releaseError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button 
            type="button" 
            onClick={onCancel} 
            disabled={releasing} 
            className="min-h-11 rounded-xl border border-border-subtle bg-surface-3 px-4 py-2 text-xs font-bold text-text-secondary hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            Tiếp tục thanh toán
          </button>
          <button 
            type="button" 
            onClick={onConfirm} 
            disabled={releasing} 
            aria-busy={releasing} 
            className="min-h-11 rounded-xl bg-danger px-4 py-2 text-xs font-bold text-white hover:bg-danger/90 transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
          >
            {releasing ? 'Đang trả ghế…' : 'Trả ghế & đóng'}
          </button>
        </div>
      </div>
    </div>
  );
});
