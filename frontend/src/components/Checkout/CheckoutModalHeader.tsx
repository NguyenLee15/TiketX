import React from 'react';
import { Sparkles, X } from 'lucide-react';

interface CheckoutModalHeaderProps {
  onRequestClose: () => void;
}

export const CheckoutModalHeader: React.FC<CheckoutModalHeaderProps> = ({ onRequestClose }) => {
  return (
    <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <h2 id="checkout-modal-title" className="text-lg font-bold text-white leading-tight">
            Thanh Toán Giữ Chỗ
          </h2>
          <p className="text-[11px] text-text-secondary">
            Xác nhận chuyển khoản VietQR hoặc cổng PayOS
          </p>
        </div>
      </div>
      <button
        onClick={onRequestClose}
        className="p-1.5 rounded-xl hover:bg-surface-2 text-text-secondary hover:text-white transition-colors cursor-pointer"
        aria-label="Đóng thanh toán"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};
