import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock3, ArrowRight, Home, Ticket, RefreshCw, AlertTriangle } from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../services/api';
import { normalizePaymentStatus, type PaymentStatus } from '../utils/customerState';
import { paymentStatusResponseSchema } from '../schemas/customerSchemas';

const TERMINAL = new Set<PaymentStatus>(['Paid', 'Failed', 'Cancelled', 'Expired', 'Used', 'Unknown']);
const BACKOFF_MS = [1500, 2500, 4000, 6000, 8000, 10000];

export type PaymentPhase =
  | { state: 'checking'; status: PaymentStatus; notice?: string }
  | { state: 'success'; status: 'Paid' | 'Used'; message?: string }
  | { state: 'pending'; status: 'Pending' | 'RefundPending'; notice?: string }
  | { state: 'failed'; status: 'Failed' | 'Cancelled' | 'Expired'; message: string; refundStatus?: string | null; notice?: string }
  | { state: 'unknown'; status: 'Unknown'; message: string };

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const orderCode = searchParams.get('orderCode') ?? '';

  const [phase, setPhase] = useState<PaymentPhase>({ state: 'checking', status: 'Pending' });
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  const timerRef = useRef<number | null>(null);
  const inFlightControllerRef = useRef<AbortController | null>(null);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      inFlightControllerRef.current?.abort();
    };
  }, []);

  const checkStatus = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    if (isCheckingRef.current) return false;
    if (!orderCode) {
      if (!signal?.aborted && mountedRef.current) {
        setPhase({
          state: 'failed',
          status: 'Failed',
          message: 'Thiếu mã đơn hàng. Hãy mở giao dịch từ trang Vé của tôi.',
        });
      }
      return true;
    }

    isCheckingRef.current = true;
    try {
      if (!signal?.aborted && mountedRef.current) {
        setPhase(prev => (prev.state === 'success' ? prev : { state: 'checking', status: prev.status }));
      }

      const response = await api.get(`/api/payments/status/${encodeURIComponent(orderCode)}`, { signal });
      const parsed = paymentStatusResponseSchema.safeParse(response.data?.data);
      if (!parsed.success) {
        if (!signal?.aborted && mountedRef.current) {
          setPhase({
            state: 'unknown',
            status: 'Unknown',
            message: 'Phản hồi từ cổng thanh toán không khớp định dạng hợp lệ. Vui lòng đối soát lại trong danh sách vé.',
          });
        }
        return true;
      }
      const next = normalizePaymentStatus(parsed.data.status);

      if (!signal?.aborted && mountedRef.current) {
        if (next === 'Paid') {
          setPhase({ state: 'success', status: 'Paid' });
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          }
        } else if (next === 'Used') {
          setPhase({
            state: 'success',
            status: 'Used',
            message: 'Vé này đã được sử dụng (đã check-in vào sự kiện thành công).',
          });
        } else if (next === 'Failed' || next === 'Cancelled' || next === 'Expired') {
          const refundStatus = parsed.data.refundStatus;
          let refundMsg = next === 'Cancelled' ? 'Giao dịch đã bị hủy.' : next === 'Expired' ? 'Giao dịch đã hết hạn thanh toán.' : 'Thanh toán không thành công.';
          let refundNotice: string | undefined = undefined;

          if (refundStatus === 'AwaitingDestination') {
            refundMsg = 'Vé đã hết hạn giữ chỗ. Hệ thống đang đợi bạn cung cấp thông tin tài khoản ngân hàng để hoàn tiền.';
            refundNotice = 'Vui lòng cập nhật tài khoản nhận tiền hoàn trong trang Hồ sơ cá nhân.';
          } else if (refundStatus === 'Processing' || refundStatus === 'Pending') {
            refundMsg = 'Giao dịch thanh toán trễ. Hệ thống đang tiến hành bồi hoàn tiền cho bạn.';
            refundNotice = 'Số tiền sẽ được chuyển về tài khoản của bạn sau khi đối soát hoàn tất.';
          } else if (refundStatus === 'Completed') {
            refundMsg = 'Đơn hàng đã được bồi hoàn tiền thành công.';
          }

          setPhase({
            state: 'failed',
            status: next,
            message: refundMsg,
            refundStatus,
            notice: refundNotice,
          });
        } else if (next === 'Unknown') {
          setPhase({
            state: 'unknown',
            status: 'Unknown',
            message: 'Phản hồi từ cổng thanh toán không khớp định dạng hợp lệ. Vui lòng đối soát lại trong danh sách vé.',
          });
        } else {
          setPhase({ state: 'pending', status: next });
        }
      }

      return TERMINAL.has(next);
    } catch (requestError: unknown) {
      if ((requestError as { code?: string })?.code !== 'ERR_CANCELED' && mountedRef.current) {
        setPhase(prev => ({
          state: prev.state === 'success' ? 'success' : 'pending',
          status: prev.status === 'Paid' ? prev.status : 'Pending',
          notice: 'Chưa thể kiểm tra giao dịch. Hệ thống sẽ tự động thử lại.',
        } as PaymentPhase));
      }
      return false;
    } finally {
      isCheckingRef.current = false;
    }
  }, [orderCode]);

  const schedulePoll = useCallback((attempt: number) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (attempt >= BACKOFF_MS.length) {
      if (mountedRef.current) {
        setPhase(prev => ({
          ...prev,
          notice: 'Giao dịch vẫn đang được xử lý. Bạn có thể kiểm tra lại hoặc xem danh sách vé.',
        } as PaymentPhase));
      }
      return;
    }

    timerRef.current = window.setTimeout(async () => {
      if (!mountedRef.current) return;
      inFlightControllerRef.current = new AbortController();
      const done = await checkStatus(inFlightControllerRef.current.signal);
      if (!done && mountedRef.current) {
        attemptRef.current++;
        schedulePoll(attemptRef.current);
      }
    }, BACKOFF_MS[attempt]);
  }, [checkStatus]);

  const handleManualRetry = useCallback(async () => {
    if (isCheckingRef.current) return;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    inFlightControllerRef.current?.abort();
    inFlightControllerRef.current = new AbortController();
    attemptRef.current = 0;
    const done = await checkStatus(inFlightControllerRef.current.signal);
    if (!done && mountedRef.current) {
      schedulePoll(0);
    }
  }, [checkStatus, schedulePoll]);

  useEffect(() => {
    inFlightControllerRef.current = new AbortController();
    attemptRef.current = 0;

    const startInitialCheck = async () => {
      const done = await checkStatus(inFlightControllerRef.current?.signal);
      if (!done && mountedRef.current) {
        schedulePoll(0);
      }
    };

    void startInitialCheck();

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      inFlightControllerRef.current?.abort();
    };
  }, [checkStatus, schedulePoll]);

  const isChecking = phase.state === 'checking';
  const isSuccess = phase.state === 'success';
  const isPending = phase.state === 'pending' || (phase.state === 'checking' && (phase.status === 'Pending' || phase.status === 'RefundPending'));
  const isUnknown = phase.state === 'unknown';

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
    ? phase.status === 'Used'
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
              onClick={() => void handleManualRetry()}
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
