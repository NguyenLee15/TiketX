import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock3, ArrowRight, Home, Ticket, RefreshCw, AlertTriangle } from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../services/api';
import { normalizePaymentStatus, type PaymentStatus } from '../utils/customerState';

const TERMINAL = new Set<PaymentStatus>(['Paid', 'Failed', 'Cancelled', 'Expired', 'Used', 'Unknown']);
const BACKOFF_MS = [1500, 2500, 4000, 6000, 8000, 10000];

export type PaymentPhase =
  | { state: 'checking'; status: PaymentStatus; notice?: string }
  | { state: 'success'; status: 'Paid' | 'Used' }
  | { state: 'pending'; status: 'Pending' | 'RefundPending'; notice?: string }
  | { state: 'failed'; status: 'Failed' | 'Cancelled' | 'Expired'; message: string }
  | { state: 'unknown'; status: 'Unknown'; message: string };

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const orderCode = searchParams.get('orderCode') ?? '';

  const [phase, setPhase] = useState<PaymentPhase>({ state: 'checking', status: 'Pending' });
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const checkStatus = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
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

    try {
      if (!signal?.aborted && mountedRef.current) {
        setPhase(prev => (prev.state === 'success' ? prev : { state: 'checking', status: prev.status }));
      }

      const response = await api.get(`/api/payments/status/${encodeURIComponent(orderCode)}`, { signal });
      const next = normalizePaymentStatus(response.data?.data?.status);

      if (!signal?.aborted && mountedRef.current) {
        if (next === 'Paid' || next === 'Used') {
          setPhase({ state: 'success', status: next });
          if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          }
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
          status: prev.status === 'Paid' || prev.status === 'Used' ? prev.status : 'Pending',
          notice: 'Chưa thể kiểm tra giao dịch. Hệ thống sẽ tự động thử lại.',
        } as PaymentPhase));
      }
      return false;
    }
  }, [orderCode]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const controller = new AbortController();
    attemptRef.current = 0;

    const poll = async () => {
      const done = await checkStatus(controller.signal);
      if (cancelled || done) return;

      const attempt = attemptRef.current++;
      if (attempt >= BACKOFF_MS.length) {
        if (mountedRef.current) {
          setPhase(prev => ({
            ...prev,
            notice: 'Giao dịch vẫn đang được xử lý. Bạn có thể kiểm tra lại hoặc xem danh sách vé.',
          } as PaymentPhase));
        }
        return;
      }

      timer = window.setTimeout(poll, BACKOFF_MS[attempt]);
    };

    void poll();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [checkStatus]);

  const isChecking = phase.state === 'checking';
  const isSuccess = phase.state === 'success';
  const isPending = phase.state === 'pending' || (phase.state === 'checking' && (phase.status === 'Pending' || phase.status === 'RefundPending'));
  const isUnknown = phase.state === 'unknown';

  const title = isSuccess
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

  const description = isSuccess
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
          {(isPending || isChecking || isUnknown) && (
            <button
              type="button"
              onClick={() => {
                attemptRef.current = 0;
                void checkStatus();
              }}
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
