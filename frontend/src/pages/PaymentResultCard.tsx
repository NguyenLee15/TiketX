import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock3, ArrowRight, Home, Ticket, RefreshCw, AlertTriangle } from 'lucide-react';
import type { PaymentPhase } from './PaymentResultPage';

interface PaymentResultCardProps {
  orderCode: string;
  phase: PaymentPhase;
  isChecking: boolean;
  isPending: boolean;
  isSuccess: boolean;
  isUnknown: boolean;
  onRetry: () => void;
}

export default function PaymentResultCard({
  orderCode,
  phase,
  isChecking,
  isPending,
  isSuccess,
  isUnknown,
  onRetry
}: PaymentResultCardProps) {
  const title = isSuccess
    ? phase.status === 'Used'
      ? 'Vé Đã Sử Dụng'
      : 'Đặt Vé Thành Công!'
    : phase.status === 'RefundPending'
    ? 'Yêu Cầu Hoàn Tiền Đang Xử Lý'
    : isPending
    ? 'Đang Xác Nhận Giao Dịch'
    : phase.status === 'Cancelled'
    ? 'Giao Dịch Đã Hủy'
    : phase.status === 'Expired'
    ? 'Giao Dịch Đã Hết Hạn'
    : isUnknown
    ? 'Trạng Thái Không Xác Định'
    : 'Thanh Toán Không Thành Công';

  const description = isSuccess
    ? phase.state === 'success' && phase.status === 'Used'
      ? (phase.message || 'Vé này đã được quét mã QR và check-in vào sự kiện thành công.')
      : 'Vé điện tử đã sẵn sàng trong mục Vé của tôi.'
    : 'message' in phase && phase.message
    ? phase.message
    : phase.status === 'RefundPending'
    ? 'Yêu cầu đã được ghi nhận và đang chờ cổng thanh toán xác nhận.'
    : isPending
    ? 'PayOS hoặc ngân hàng có thể cần thêm thời gian để gửi xác nhận. Không thanh toán lại đơn này.'
    : isUnknown
    ? 'Hệ thống nhận được trạng thái bất thường từ cổng thanh toán. Vui lòng kiểm tra lại danh sách vé hoặc liên hệ hỗ trợ.'
    : 'Giao dịch chưa tạo vé hợp lệ. Bạn có thể quay lại chọn ghế khác.';

  const notice = 'notice' in phase ? phase.notice : undefined;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 text-text-primary">
      <section className="surface-panel max-w-lg w-full p-8 md:p-12 text-center shadow-2xl" aria-live="polite" aria-busy={isChecking}>
        <div
          className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center border ${
            isSuccess
              ? 'border-success/40 bg-success/10 text-success'
              : isPending
              ? 'border-warning/40 bg-warning/10 text-warning'
              : isUnknown
              ? 'border-warning/40 bg-warning/10 text-warning'
              : 'border-danger/30 bg-danger/10 text-danger'
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 className="w-12 h-12" aria-hidden="true" />
          ) : isPending ? (
            <Clock3 className="w-12 h-12" aria-hidden="true" />
          ) : isUnknown ? (
            <AlertTriangle className="w-12 h-12" aria-hidden="true" />
          ) : (
            <XCircle className="w-12 h-12" aria-hidden="true" />
          )}
        </div>

        <h1 className="mt-6 text-3xl font-display font-black text-white text-balance">{title}</h1>
        <p className="mt-3 text-text-secondary text-sm leading-relaxed">{description}</p>
        {orderCode && (
          <p className="mt-3 text-xs text-text-tertiary">
            Mã đơn hàng: <span className="font-mono font-bold text-brand-primary" translate="no">#{orderCode}</span>
          </p>
        )}
        {notice && <p role="alert" className="mt-4 text-xs text-warning">{notice}</p>}

        <div className="mt-7 space-y-3">
          {'refundStatus' in phase && phase.refundStatus === 'AwaitingDestination' && (
            <Link
              to="/profile"
              className="w-full py-3 bg-warning hover:bg-warning/90 text-black font-bold rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-white flex justify-center items-center gap-2"
            >
              Cập Nhật Tài Khoản Hoàn Tiền
            </Link>
          )}
          {(isPending || isChecking || isUnknown) && (
            <button
              type="button"
              onClick={onRetry}
              disabled={isChecking}
              className="w-full py-3 bg-brand-primary hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl transition-opacity focus-visible:ring-2 focus-visible:ring-white flex justify-center items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} aria-hidden="true" />
              {isChecking ? 'Đang kiểm tra…' : 'Kiểm Tra Lại'}
            </button>
          )}
          <Link
            to="/my-tickets"
            className="w-full py-3 bg-surface-2 hover:bg-surface-3 text-white font-bold rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary flex justify-center items-center gap-2"
          >
            <Ticket className="w-4 h-4" aria-hidden="true" />
            Vé Của Tôi
          </Link>
          <Link
            to="/"
            className="w-full py-3 text-text-secondary hover:text-white rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary flex justify-center items-center gap-2"
          >
            {isSuccess ? <Home className="w-4 h-4" aria-hidden="true" /> : <ArrowRight className="w-4 h-4" aria-hidden="true" />}
            {isSuccess ? 'Về Trang Chủ' : 'Chọn Sự Kiện Khác'}
          </Link>
        </div>
      </section>
    </div>
  );
}
