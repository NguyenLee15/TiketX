import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock3, ArrowRight, Home, Ticket, RefreshCw, AlertTriangle } from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../services/api';
import { normalizePaymentStatus, type PaymentStatus } from '../utils/customerState';
import { paymentStatusResponseSchema } from '../schemas/customerSchemas';
import type { RefundStatus } from '../schemas/customerSchemas';

const TERMINAL = new Set<PaymentStatus>(['Paid', 'Failed', 'Cancelled', 'Expired', 'Used', 'Unknown']);
const BACKOFF_MS = [1500, 2500, 4000, 6000, 8000, 10000];

export type PaymentPhase =
  | { state: 'checking'; status: PaymentStatus; notice?: string }
  | { state: 'success'; status: 'Paid' }
  | { state: 'pending'; status: 'Pending' | 'RefundPending'; notice?: string }
  | { state: 'failed'; status: 'Failed' | 'Cancelled' | 'Expired' | 'Used'; message: string }
  | { state: 'unknown'; status: 'Unknown'; message: string }
  | { state: 'compensation'; status: 'Cancelled' | 'RefundPending'; refundStatus: RefundStatus };

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
      const refundStatus = parsed.data.refundStatus;

      if (!signal?.aborted && mountedRef.current) {
        if (next === 'Paid') {
          setPhase({ state: 'success', status: 'Paid' });
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          }
        } else if (next === 'Used') {
          setPhase({
            state: 'failed',
            status: 'Used',
            message: 'Vé này đã được sử dụng (đã check-in vào sự kiện).',
          });
        } else if (refundStatus) {
          setPhase({ state: 'compensation', status: next === 'RefundPending' ? 'RefundPending' : 'Cancelled', refundStatus });
        } else if (next === 'Failed' || next === 'Cancelled' || next === 'Expired') {
          setPhase({
            state: 'failed',
            status: next,
            message: next === 'Cancelled' ? 'Giao dịch đã bị hủy.' : next === 'Expired' ? 'Giao dịch đã hết hạn thanh toán.' : 'Thanh toán không thành công.',
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
  const isCompensation = phase.state === 'compensation';

  const title = isCompensation
    ? phase.refundStatus === 'Completed' ? 'Đã bồi hoàn'
      : phase.refundStatus === 'NeedsReview' || phase.refundStatus === 'Failed' ? 'Bồi hoàn cần hỗ trợ'
      : phase.refundStatus === 'AwaitingDestination' ? 'Cần tài khoản nhận tiền'
      : 'Giao dịch đang được bồi hoàn'
    : isSuccess
    ? 'Đặt Vé Thành Công!'
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

  const description = isCompensation
    ? phase.refundStatus === 'AwaitingDestination' ? 'Cần thiết lập tài khoản nhận tiền để tiếp tục bồi hoàn.'
      : phase.refundStatus === 'NeedsReview' ? 'Khoản bồi hoàn cần đối soát. Vui lòng liên hệ hỗ trợ.'
      : phase.refundStatus === 'Failed' ? 'Yêu cầu bồi hoàn chưa hoàn tất. Vui lòng liên hệ hỗ trợ.'
      : phase.refundStatus === 'Completed' ? 'Khoản bồi hoàn đã được xác nhận.'
      : phase.refundStatus === 'Pending' ? 'Khoản bồi hoàn đang chờ xử lý.'
      : phase.refundStatus === 'Unknown' ? 'Trạng thái bồi hoàn đang được kiểm tra.'
      : 'Khoản bồi hoàn đang được xử lý. Vui lòng theo dõi trong Vé của tôi.'
    : isSuccess
    ? 'Vé điện tử đã sẵn sàng trong mục Vé của tôi.'
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
          {isCompensation && phase.refundStatus === 'AwaitingDestination' && (
            <Link to="/profile?refundBankAccount=1" className="w-full py-3 bg-brand-primary text-white font-bold rounded-xl flex justify-center items-center">Thiết lập tài khoản nhận tiền</Link>
          )}
          {isCompensation && (phase.refundStatus === 'NeedsReview' || phase.refundStatus === 'Failed') && (
            <a href="mailto:support@tickex.vn" className="w-full py-3 bg-brand-primary text-white font-bold rounded-xl flex justify-center items-center">Liên hệ hỗ trợ</a>
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
