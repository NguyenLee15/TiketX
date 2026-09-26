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
      className="absolute inset-0 z-20 flex items-center justify-center bg-surface-1/95 p-5" 
      role="alertdialog" 
      aria-modal="true" 
      aria-labelledby="release-confirm-title"
    >
      <div ref={dialogRef} className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface-2 p-5 shadow-2xl space-y-3">
        <h3 id="release-confirm-title" className="text-base font-bold text-white">
          Rời phiên thanh toán?
        </h3>
        <p className="text-xs leading-relaxed text-text-secondary">Hệ thống sẽ xác nhận hủy liên kết thanh toán với PayOS trước khi trả ghế. Nếu chưa xác nhận được, ghế vẫn được giữ.</p>
        
        {releaseError && (
          <p role="alert" aria-live="polite" className="text-xs text-danger-readable">
            {releaseError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button 
            type="button" 
            onClick={onCancel} 
            disabled={releasing} 
            className="rounded-xl border border-border-subtle bg-surface-3 px-4 py-2 text-xs font-bold text-text-secondary hover:text-white transition-colors cursor-pointer"
          >
            Tiếp tục thanh toán
          </button>
          <button 
            type="button" 
            onClick={onConfirm} 
            disabled={releasing} 
            className="rounded-xl bg-danger px-4 py-2 text-xs font-bold text-surface-0 hover:bg-red-400 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {releasing ? 'Đang trả ghế…' : 'Trả ghế & đóng'}
          </button>
        </div>
      </div>
    </div>
  );
});
