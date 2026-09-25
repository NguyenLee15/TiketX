import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Loader2, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { EventDetail, Seat } from '../types';
import api from '../services/api';
import { CheckoutInvoice } from './Checkout/CheckoutInvoice';
import { CheckoutVietQrView, PaymentInfo } from './Checkout/CheckoutVietQrView';
import { CheckoutReleaseDialog } from './Checkout/CheckoutReleaseDialog';
import { useModalAccessibility } from './Admin/useModalAccessibility';
import { checkoutLinkResponseSchema } from '../schemas/customerSchemas';

interface CheckoutModalProps {
  isOpen?: boolean;
  onClose: () => void;
  event: EventDetail;
  seat: Seat;
  ticketId: string | null;
  expiresAt: string | null | undefined;
}

export default function CheckoutModal({
  isOpen = true,
  onClose,
  event,
  seat,
  ticketId,
  expiresAt,
}: CheckoutModalProps) {
  const navigate = useNavigate();
  const [paymentData, setPaymentData] = useState<PaymentInfo | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [paymentInitError, setPaymentInitError] = useState<string | null>(null);
  const [paymentRetryKey, setPaymentRetryKey] = useState(0);

  const calculateRemaining = useCallback((target: string | null | undefined) => {
    if (!target) return 0;
    const diff = Math.floor((new Date(target).getTime() - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  }, []);

  const [timeLeft, setTimeLeft] = useState(() => calculateRemaining(expiresAt));
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const simulateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleModalClose = useCallback(() => {
    if (status === 'error') {
      onClose();
    } else {
      setShowCloseConfirm(true);
    }
  }, [status, onClose]);

  useModalAccessibility(Boolean(isOpen), releasing || loadingPayment, handleModalClose, modalRef);

  // Sync timeLeft when expiresAt changes
  useEffect(() => {
    setTimeLeft(calculateRemaining(expiresAt));
  }, [expiresAt, calculateRemaining]);

  // Fetch payment link from backend
  useEffect(() => {
    if (!isOpen || !ticketId) return;
    let isMounted = true;
    const controller = new AbortController();

    const initPayment = async () => {
      try {
        setLoadingPayment(true);
        setPaymentInitError(null);
        const returnUrl = `${window.location.origin}/payment/result`;
        const cancelUrl = `${window.location.origin}/payment/result`;
        
        const response = await api.post('/api/payments/create-link', {
          ticketId,
          returnUrl,
          cancelUrl,
        }, { signal: controller.signal });

        if (isMounted && response.data.success) {
          const parsed = checkoutLinkResponseSchema.safeParse(response.data.data);
          if (parsed.success) {
            setPaymentData(parsed.data as PaymentInfo);
          } else {
            const msg = 'Dữ liệu thông tin thanh toán không hợp lệ.';
            setPaymentInitError(msg);
            toast.error(msg);
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const apiErr = err as { response?: { data?: { message?: string } } };
        if ((err as { code?: string })?.code !== 'ERR_CANCELED') {
          const msg = apiErr.response?.data?.message || 'Không thể tạo mã thanh toán lúc này. Vui lòng thử lại.';
          setPaymentInitError(msg);
          toast.error(msg);
        }
      } finally {
        if (isMounted) setLoadingPayment(false);
      }
    };

    void initPayment();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [isOpen, ticketId, paymentRetryKey]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || status !== 'idle') return;
    
    const timer = setInterval(() => {
      const remaining = calculateRemaining(expiresAt);
      if (remaining <= 0) {
        clearInterval(timer);
        setTimeLeft(0);
        setStatus('error');
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, status, expiresAt, calculateRemaining]);

  // Cleanup simulation timer
  useEffect(() => {
    return () => {
      if (simulateTimerRef.current) clearTimeout(simulateTimerRef.current);
    };
  }, []);

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!navigator.clipboard?.writeText) {
      toast.error(`Không thể sao chép ${fieldName}.`);
      return;
    }
    void navigator.clipboard.writeText(text)
      .then(() => toast.success(`Đã sao chép ${fieldName}!`))
      .catch(() => toast.error(`Không thể sao chép ${fieldName}.`));
  };

  const handleProceedPayOS = () => {
    if (!paymentData?.checkoutUrl) return;
    if (paymentData.checkoutUrl.startsWith('http')) {
      window.location.href = paymentData.checkoutUrl;
    } else {
      navigate(paymentData.checkoutUrl);
    }
  };

  const handleReleaseAndClose = async () => {
    if (releasing || status !== 'idle' || !ticketId) return;
    setReleasing(true);
    setReleaseError('');
    try {
      await api.post(`/api/reservations/${ticketId}/release`, { reason: 'CustomerClosedCheckout' });
      setShowCloseConfirm(false);
      onClose();
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { message?: string } } };
      setReleaseError(apiError.response?.data?.message ?? 'Không thể trả ghế lúc này. Vui lòng thử lại.');
    } finally {
      setReleasing(false);
    }
  };

  const handleSimulatePayment = () => {
    if (!paymentData?.orderCode) return;
    setStatus('verifying');
    toast.success('Mô phỏng thanh toán thành công!');
    simulateTimerRef.current = setTimeout(() => {
      navigate(`/payment/result?orderCode=${paymentData.orderCode}&status=PAID`);
    }, 700);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="checkout-modal-title">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowCloseConfirm(true)} />

      <div ref={modalRef} className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-surface-1 border border-border-subtle shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 text-text-primary z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 id="checkout-modal-title" className="text-lg font-bold text-white leading-tight">Thanh Toán Giữ Chỗ</h2>
              <p className="text-[11px] text-text-secondary">Xác nhận chuyển khoản VietQR hoặc cổng PayOS</p>
            </div>
          </div>
          <button onClick={() => setShowCloseConfirm(true)} className="p-1.5 rounded-xl hover:bg-surface-2 text-text-secondary hover:text-white transition-colors cursor-pointer" aria-label="Đóng thanh toán">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {status === 'idle' && (
          <div className="space-y-4">
            <CheckoutInvoice
              event={event}
              seat={seat}
              timeLeft={timeLeft}
              formatTime={formatTime}
              status={status}
            />

            <CheckoutVietQrView
              loadingPayment={loadingPayment}
              paymentInitError={paymentInitError}
              paymentData={paymentData}
              onRetryPayment={() => setPaymentRetryKey(k => k + 1)}
              onProceedPayOS={handleProceedPayOS}
              copyToClipboard={copyToClipboard}
            />

            {/* Dev Simulate & Cancel Actions */}
            <div className="space-y-2 pt-1">
              {import.meta.env.DEV && paymentData?.checkoutUrl && (
                <button 
                  onClick={handleSimulatePayment}
                  className="w-full py-2 bg-warning/10 hover:bg-warning/20 border border-warning/30 text-warning text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  ⚡ [DEV] Giả lập Thanh Toán Thành Công
                </button>
              )}

              <button 
                onClick={() => setShowCloseConfirm(true)}
                disabled={releasing}
                className="w-full py-2.5 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white text-xs font-semibold rounded-xl transition-colors border border-border-subtle cursor-pointer"
              >
                {releasing ? 'Đang trả ghế…' : 'Trả Ghế & Quay Lại'}
              </button>
            </div>
          </div>
        )}

        {status === 'verifying' && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center border border-brand-primary/30">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
            <h3 className="text-xl font-bold text-white">Đang Xác Nhận Giao Dịch</h3>
            <p className="text-text-secondary text-xs max-w-xs">
              Hệ thống đang đối soát mã đơn hàng và ký chữ ký số mã QR cho vé của bạn...
            </p>
          </div>
        )}

        {status === 'error' && (
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
        )}

        {/* Release Confirmation Dialog */}
        <CheckoutReleaseDialog
          isOpen={showCloseConfirm && status === 'idle'}
          releasing={releasing}
          releaseError={releaseError}
          onCancel={() => setShowCloseConfirm(false)}
          onConfirm={handleReleaseAndClose}
        />
      </div>
    </div>
  );
}
