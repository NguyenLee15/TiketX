import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';
import ConfirmModal from '../../components/Admin/ConfirmModal';
import { formatCurrency } from '../../utils/formatters';
import { TicketItemData } from './TicketCard';

interface TicketRefundModalProps {
  candidate: TicketItemData | null;
  refundingId: string | null;
  refundError?: { code?: string; message?: string } | null;
  onClose: () => void;
  onConfirm: (candidate: TicketItemData) => Promise<void>;
}

export const TicketRefundModal: React.FC<TicketRefundModalProps> = React.memo(({
  candidate,
  refundingId,
  refundError,
  onClose,
  onConfirm,
}) => {
  const navigate = useNavigate();
  const isMissingBank = refundError?.code === 'REFUND_DESTINATION_REQUIRED';

  return (
    <ConfirmModal
      isOpen={Boolean(candidate)}
      onClose={() => { if (!refundingId) onClose(); }}
      onConfirm={async () => {
        if (!candidate) return;
        await onConfirm(candidate);
      }}
      isLoading={Boolean(refundingId)}
      title="Xác nhận yêu cầu hoàn vé"
      confirmText={isMissingBank ? "Thử lại hoàn vé" : "Gửi yêu cầu hoàn"}
      type="warning"
      message={candidate ? (
        <div className="space-y-3 text-xs text-left">
          <p>Bạn đang yêu cầu hoàn vé cho <strong>{candidate.eventTitle}</strong>, hàng {candidate.row} – ghế {candidate.number}.</p>
          <p>Số tiền dự kiến: <strong>{formatCurrency(candidate.price)}</strong>.</p>
          <p className="text-warning font-semibold">Vé sẽ chuyển sang trạng thái “Đang hoàn tiền” và chỉ hoàn tất sau khi cổng thanh toán xác nhận.</p>
          
          {isMissingBank && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-text-primary">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Chưa có thông tin nhận hoàn tiền</span>
              </div>
              <p className="text-text-secondary text-[11px] leading-relaxed">
                Hệ thống cần số tài khoản ngân hàng để chuyển trả tiền hoàn vé. Vui lòng thiết lập tài khoản nhận tiền tại trang Hồ Sơ.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/profile');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 transition-colors shadow-sm"
              >
                <span>Thiết lập tài khoản nhận tiền</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      ) : ''}
    />
  );
});
