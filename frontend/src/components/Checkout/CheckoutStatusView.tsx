import React from 'react';
import { Loader2, XCircle } from 'lucide-react';

interface CheckoutStatusViewProps {
  status: 'idle' | 'verifying' | 'error' | 'success';
  onClose: () => void;
}

export const CheckoutStatusView: React.FC<CheckoutStatusViewProps> = ({ status, onClose }) => {
  if (status === 'verifying') {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
        <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center border border-brand-primary/30">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
        <h3 className="text-xl font-bold text-white">Đang Xác Nhận Giao Dịch</h3>
        <p className="text-text-secondary text-xs max-w-xs">
          Hệ thống đang đối soát mã đơn hàng và ký chữ ký số mã QR cho vé của bạn...
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
        <div className="w-16 h-16 bg-danger/10 rounded-2xl flex items-center justify-center border border-danger/30 text-danger">
          <XCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white">Hết Thời Gian Giữ Chỗ</h3>
        <p className="text-text-secondary text-xs max-w-xs leading-relaxed">
          Thời gian giữ chỗ trên hệ thống đã kết thúc. Ghế đã được giải phóng tự động để đảm bảo công bằng cho khán giả khác.
        </p>
        <button
          onClick={onClose}
          className="px-6 py-3 bg-surface-2 hover:bg-surface-3 text-white text-xs font-bold rounded-xl transition-colors border border-border-subtle cursor-pointer"
        >
          Đóng & Quay Lại Sơ Đồ Ghế
        </button>
      </div>
    );
  }

  return null;
};
