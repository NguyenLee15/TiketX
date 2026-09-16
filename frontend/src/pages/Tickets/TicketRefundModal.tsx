import React from 'react';
import ConfirmModal from '../../components/Admin/ConfirmModal';
import { formatCurrency } from '../../utils/formatters';
import { TicketItemData } from './TicketCard';

interface TicketRefundModalProps {
  candidate: TicketItemData | null;
  refundingId: string | null;
  onClose: () => void;
  onConfirm: (candidate: TicketItemData) => Promise<void>;
}

export const TicketRefundModal: React.FC<TicketRefundModalProps> = React.memo(({
  candidate,
  refundingId,
  onClose,
  onConfirm,
}) => {
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
      confirmText="Gửi yêu cầu hoàn"
      type="warning"
      message={candidate ? (
        <div className="space-y-2 text-xs">
          <p>Bạn đang yêu cầu hoàn vé cho <strong>{candidate.eventTitle}</strong>, hàng {candidate.row} – ghế {candidate.number}.</p>
          <p>Số tiền dự kiến: <strong>{formatCurrency(candidate.price)}</strong>.</p>
          <p className="text-warning font-semibold">Vé sẽ chuyển sang trạng thái “Đang hoàn tiền” và chỉ hoàn tất sau khi cổng thanh toán xác nhận.</p>
        </div>
      ) : ''}
    />
  );
});
