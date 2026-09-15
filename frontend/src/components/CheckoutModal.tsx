import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, XCircle, CreditCard, Clock, Copy, CheckCircle2, Receipt, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Seat, EventDetail } from '../types';
import api from '../services/api';
import { formatCurrency } from '../utils/formatters';

interface CheckoutModalProps {
  seat: Seat;
  event: EventDetail;
  ticketId: string;
  expiresAt?: string;
  onClose: () => void;
}

interface PaymentInfo {
  orderCode: number;
  amount: number;
  accountNumber: string;
  accountName: string;
  bankName: string;
  qrCodeUrl: string;
  checkoutUrl?: string;
}

export default function CheckoutModal({ seat, event, ticketId, expiresAt, onClose }: CheckoutModalProps) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'verifying' | 'error'>('idle');
  const [paymentData, setPaymentData] = useState<PaymentInfo | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(true);
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);
  const [releaseError, setReleaseError] = useState('');
  const [releasing, setReleasing] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const simulateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestClose = useCallback(() => {
    if (!releasing && status === 'idle') setShowCloseConfirm(true);
  }, [releasing, status]);
  const statusRef = useRef(status);
  const requestCloseRef = useRef(requestClose);
  statusRef.current = status;
  requestCloseRef.current = requestClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modalRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && statusRef.current === 'idle') requestCloseRef.current();
      if (event.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); openerRef.current?.focus(); };
  }, []);

  useEffect(() => () => {
    if (simulateTimerRef.current) clearTimeout(simulateTimerRef.current);
  }, []);

  // Helper to compute remaining seconds from server expiresAt
  const calculateRemaining = useCallback((expiryStr?: string) => {
    if (!expiryStr) return 300;
    const expiryTime = new Date(expiryStr).getTime();
    const diff = Math.floor((expiryTime - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  }, []);

  const [timeLeft, setTimeLeft] = useState<number>(() => calculateRemaining(expiresAt));

  // Sync remaining time when expiresAt changes
  useEffect(() => {
    setTimeLeft(calculateRemaining(expiresAt));
  }, [expiresAt, calculateRemaining]);

  // Load payment link / VietQR data upon opening
  useEffect(() => {
    let isMounted = true;
    const initPayment = async () => {
      try {
        setLoadingPayment(true);
        const returnUrl = `${window.location.origin}/payment/result`;
        const cancelUrl = `${window.location.origin}/payment/result`;
        
        const response = await api.post('/api/payments/create-link', {
          ticketId: ticketId,
          returnUrl: returnUrl,
          cancelUrl: cancelUrl
        });

        if (isMounted && response.data.success) {
          setPaymentData(response.data.data);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const apiErr = err as { response?: { data?: { message?: string } } };
        console.error('Error initiating payment:', err);
        toast.error(apiErr.response?.data?.message || 'Không thể tạo mã thanh toán');
      } finally {
        if (isMounted) setLoadingPayment(false);
      }
    };

    initPayment();
    return () => {
      isMounted = false;
    };
  }, [ticketId]);

  // Wall-clock synchronized countdown timer
  useEffect(() => {
    if (status !== 'idle') return;
    
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
  }, [status, expiresAt, calculateRemaining]);

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
    if (releasing || status !== 'idle') return;
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

  const orderCode = paymentData?.orderCode;
  const transferContent = `TICKEX ${orderCode}`;
  const qrUrl = paymentData?.qrCodeUrl;
  const hasBankDetails = Boolean(
    paymentData?.bankName?.trim() &&
    paymentData?.accountNumber?.trim() &&
    paymentData?.accountName?.trim()
  );

  const getTierName = (tier: number, row: string) => {
    if (tier === 1 || row === 'A' || row === 'B') return 'VIP';
    if (tier === 2 || row === 'E') return 'Economy';
    return 'Standard';
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-surface-1/95 animate-in fade-in duration-200"
        aria-hidden="true"
        onClick={requestClose}
      />
      
      {/* Modal Content */}
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="checkout-title" tabIndex={-1} className="surface-panel w-full max-w-xl p-6 md:p-8 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 z-10 max-h-[90vh] overflow-y-auto overscroll-contain">
        
        {/* Ambient Glows */}

        {status === 'idle' && (
          <div className="relative z-10 space-y-5">
            {/* Header with Server-Synchronized Timer */}
            <div className="flex justify-between items-start border-b border-border-subtle pb-4">
              <div>
                <h2 id="checkout-title" className="text-xl md:text-2xl font-display font-bold text-white mb-1 flex items-center gap-2">
                  <CreditCard className="w-6 h-6 text-brand-primary" />
                  Thanh Toán Vé Sự Kiện
                </h2>
                <p className="text-text-secondary text-xs flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-warning" />
                  Thời gian giữ chỗ còn lại:{' '}
                  <span className="text-warning font-mono font-bold text-sm">
                    {formatTime(timeLeft)}
                  </span>
                </p>
              </div>
              <button 
                onClick={requestClose}
                data-release-close
                className="p-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-tertiary hover:text-white transition-colors"
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            {/* Itemized Invoice Breakdown */}
            <div className="rounded-2xl bg-surface-2/60 border border-border-subtle p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border-subtle/60">
                <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  <Receipt className="w-3.5 h-3.5 text-brand-primary" />
                  Chi tiết hóa đơn đặt vé
                </div>
                <span className="text-[11px] font-mono text-text-tertiary">Mã vé: #{ticketId.substring(0, 8)}</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-text-secondary">
                  <span>Sự kiện:</span>
                  <span className="text-white font-medium truncate max-w-[260px] text-right">{event.title}</span>
                </div>
                <div className="flex justify-between items-center text-text-secondary">
                  <span>Địa điểm:</span>
                  <span className="text-white font-medium truncate max-w-[260px] text-right">{event.venueName || event.location}</span>
                </div>
                <div className="flex justify-between items-center text-text-secondary">
                  <span>Vị trí ghế:</span>
                  <span className="text-white font-semibold">
                    Hàng {seat.row} - Ghế {seat.number} ({getTierName(seat.tier, seat.row)})
                  </span>
                </div>
                <div className="flex justify-between items-center text-text-secondary">
                  <span>Giá vé niêm yết:</span>
                  <span className="text-white font-mono">{formatCurrency(seat.price)}</span>
                </div>
                <div className="flex justify-between items-center text-text-secondary">
                  <span>Phí dịch vụ & xuất vé điện tử:</span>
                  <span className="text-success font-medium">0đ (Miễn phí)</span>
                </div>
                <div className="flex justify-between items-center text-text-secondary">
                  <span>Thuế VAT:</span>
                  <span className="text-text-tertiary">Đã bao gồm trong giá vé</span>
                </div>
              </div>

              <div className="pt-2.5 border-t border-border-subtle/60 flex justify-between items-baseline">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Tổng tiền thanh toán</span>
                <span className="text-2xl font-black text-success font-display">
                  {formatCurrency(seat.price)}
                </span>
              </div>
            </div>

            {/* VietQR Scanner / PayOS Section */}
            {loadingPayment ? (
              <div className="p-8 rounded-2xl bg-surface-2/40 border border-border-subtle flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                <p className="text-text-secondary text-xs">Đang khởi tạo mã QR thanh toán...</p>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-surface-2/40 border border-border-subtle flex flex-col md:flex-row items-center gap-5">
                <div className="w-36 h-36 bg-white p-2 rounded-2xl shadow-xl shrink-0 flex items-center justify-center border-4 border-surface-3">
                  {qrUrl ? <img src={qrUrl} alt="Mã VietQR thanh toán" width="128" height="128" className="w-full h-full object-contain" /> : <span className="text-xs text-slate-500 text-center">Thanh toán qua PayOS</span>}
                </div>

                <div className="flex-1 w-full space-y-2 text-xs">
                  {hasBankDetails && (
                    <>
                      <div className="flex justify-between items-center p-2 rounded-xl bg-surface-3/60 border border-border-subtle">
                        <span className="text-text-secondary">Ngân hàng:</span>
                        <span className="font-bold text-white">{paymentData?.bankName}</span>
                      </div>

                      <div className="flex justify-between items-center p-2 rounded-xl bg-surface-3/60 border border-border-subtle">
                        <span className="text-text-secondary">Số tài khoản:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-white">{paymentData?.accountNumber}</span>
                          <button
                            onClick={() => paymentData?.accountNumber && copyToClipboard(paymentData.accountNumber, 'Số tài khoản')}
                            className="p-1 hover:text-brand-primary text-text-secondary transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
                            title="Sao chép số tài khoản"
                            aria-label="Sao chép số tài khoản"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center p-2 rounded-xl bg-surface-3/60 border border-border-subtle">
                        <span className="text-text-secondary">Chủ tài khoản:</span>
                        <span className="font-bold text-white uppercase">{paymentData?.accountName}</span>
                      </div>
                    </>
                  )}

                  {hasBankDetails && (
                    <div className="flex justify-between items-center p-2 rounded-xl bg-brand-primary/10 border border-brand-primary/30">
                      <span className="text-brand-primary font-semibold">Nội dung CK:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-brand-primary">{transferContent}</span>
                        <button
                          onClick={() => copyToClipboard(transferContent, 'Nội dung chuyển khoản')}
                          className="p-1 hover:text-white text-brand-primary transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
                          title="Sao chép nội dung chuyển khoản"
                          aria-label="Sao chép nội dung chuyển khoản"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              {paymentData?.checkoutUrl && paymentData.checkoutUrl.startsWith('http') && (
                <button 
                  onClick={handleProceedPayOS}
                  className="w-full py-3.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold rounded-lg transition-[background-color,transform] flex items-center justify-center gap-2 group text-sm active:scale-98 focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <span>Chuyển Đến Cổng Thanh Toán PayOS</span>
                  <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              {import.meta.env.DEV && paymentData?.checkoutUrl && (
                <button 
                  onClick={handleSimulatePayment}
                  className="w-full py-3 bg-success hover:bg-success/90 text-white font-bold rounded-lg transition-[background-color,transform] flex items-center justify-center gap-2 text-xs active:scale-98 focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mô Phỏng Chuyển Khoản Thành Công (Môi trường Dev)</span>
                </button>
              )}

              <button 
                onClick={requestClose}
                disabled={releasing}
                className="w-full py-2.5 bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white text-xs font-semibold rounded-xl transition-colors border border-border-subtle"
              >
                {releasing ? 'Đang trả ghế…' : 'Trả Ghế & Quay Lại'}
              </button>
              {releaseError && <p role="alert" aria-live="polite" className="text-center text-xs text-danger">{releaseError}</p>}
            </div>
          </div>
        )}

        {status === 'verifying' && (
          <div className="flex flex-col items-center justify-center py-16 relative z-10 space-y-4">
            <div className="relative">
              <div className="w-16 h-16 bg-surface-2 rounded-2xl flex items-center justify-center border border-brand-primary/30 relative z-10">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white">Đang Xác Nhận Giao Dịch</h3>
            <p className="text-text-secondary text-center text-xs max-w-xs">
              Hệ thống đang đối soát mã đơn hàng và ký chữ ký số mã QR cho vé của bạn...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center py-12 relative z-10 space-y-4 text-center">
            <div className="w-16 h-16 bg-danger/10 rounded-2xl flex items-center justify-center border border-danger/30 text-danger">
              <XCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Hết Thời Gian Giữ Chỗ</h3>
            <p className="text-text-secondary text-xs max-w-xs leading-relaxed">
              {timeLeft <= 0 
                ? "Thời gian giữ chỗ trên hệ thống đã kết thúc. Ghế đã được giải phóng tự động để đảm bảo công bằng cho khán giả khác." 
                : "Không thể hoàn tất giao dịch lúc này. Vui lòng thử lại hoặc chọn ghế khác."}
            </p>
            <button 
              onClick={onClose}
              className="px-6 py-3 bg-surface-2 hover:bg-surface-3 text-white text-xs font-bold rounded-xl transition-colors border border-border-subtle mt-2"
            >
              Đóng & Quay Lại Sơ Đồ Ghế
            </button>
          </div>
        )}

        {showCloseConfirm && status === 'idle' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-surface-1/95 p-5" role="dialog" aria-modal="true" aria-labelledby="release-confirm-title">
            <div className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface-2 p-5 shadow-2xl">
              <h3 id="release-confirm-title" className="text-base font-bold text-white">Rời phiên thanh toán?</h3>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">Ghế sẽ được trả lại và liên kết thanh toán hiện tại có thể không còn sử dụng được.</p>
              {releaseError && <p role="alert" aria-live="polite" className="mt-3 text-xs text-danger">{releaseError}</p>}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setShowCloseConfirm(false)} disabled={releasing} className="rounded-xl border border-border-subtle bg-surface-3 px-4 py-2 text-xs font-bold text-text-secondary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">Tiếp tục thanh toán</button>
                <button type="button" onClick={handleReleaseAndClose} disabled={releasing} className="rounded-xl bg-danger px-4 py-2 text-xs font-bold text-white hover:bg-danger/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">{releasing ? 'Đang trả ghế…' : 'Trả ghế & đóng'}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
