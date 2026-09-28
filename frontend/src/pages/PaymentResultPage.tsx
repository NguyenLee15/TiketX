import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import api from '../services/api';
import { normalizePaymentStatus, type PaymentStatus } from '../utils/customerState';
import { paymentStatusResponseSchema } from '../schemas/customerSchemas';
import PaymentResultCard from './PaymentResultCard';

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
  const [pollAttempt, setPollAttempt] = useState(0);
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
      setPollAttempt(BACKOFF_MS.length);
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
      setPollAttempt(attempt + 1);
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
    setPollAttempt(0);
    const done = await checkStatus(inFlightControllerRef.current.signal);
    if (!done && mountedRef.current) {
      schedulePoll(0);
    }
  }, [checkStatus, schedulePoll]);

  useEffect(() => {
    inFlightControllerRef.current = new AbortController();
    attemptRef.current = 0;
    setPollAttempt(0);

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

  return (
    <PaymentResultCard
      orderCode={orderCode}
      phase={phase}
      isChecking={isChecking}
      isPending={isPending}
      isSuccess={isSuccess}
      isUnknown={isUnknown}
      pollAttempt={pollAttempt}
      pollLimit={BACKOFF_MS.length}
      onRetry={() => void handleManualRetry()}
    />
  );
}
