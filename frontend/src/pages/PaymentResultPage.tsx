import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock3, ArrowRight, Home, Ticket, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import api from '../services/api';
import { normalizePaymentStatus, type PaymentStatus } from '../utils/customerState';

const TERMINAL = new Set<PaymentStatus>(['Paid', 'Failed', 'Cancelled', 'Expired']);
const BACKOFF_MS = [1500, 2500, 4000, 6000, 8000, 10000];

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const orderCode = searchParams.get('orderCode') ?? '';
  const [status, setStatus] = useState<PaymentStatus>('Pending');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const attemptRef = useRef(0);

  const checkStatus = useCallback(async () => {
    if (!orderCode) {
      setStatus('Failed'); setError('Thiếu mã đơn hàng. Hãy mở giao dịch từ trang Vé của tôi.'); setChecking(false); return true;
    }
    try {
      setChecking(true); setError('');
      const response = await api.get(`/api/payments/status/${encodeURIComponent(orderCode)}`);
      const next = normalizePaymentStatus(response.data?.data?.status);
      setStatus(next);
      if (next === 'Paid' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      return TERMINAL.has(next);
    } catch {
      setError('Chưa thể kiểm tra giao dịch. Hệ thống sẽ tự thử lại.'); return false;
    } finally { setChecking(false); }
  }, [orderCode]);

  useEffect(() => {
    let cancelled = false; let timer: number | undefined;
    attemptRef.current = 0;
    const poll = async () => {
      const done = await checkStatus();
      if (cancelled || done) return;
      const attempt = attemptRef.current++;
      if (attempt >= BACKOFF_MS.length) { setError('Giao dịch vẫn đang được xử lý. Bạn có thể kiểm tra lại hoặc xem danh sách vé.'); return; }
      timer = window.setTimeout(poll, BACKOFF_MS[attempt]);
    };
    void poll();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [checkStatus]);

  const paid = status === 'Paid'; const pending = status === 'Pending';
  const title = paid ? 'Đặt Vé Thành Công!' : pending ? 'Đang Xác Nhận Giao Dịch' : status === 'Cancelled' ? 'Giao Dịch Đã Hủy' : status === 'Expired' ? 'Giao Dịch Đã Hết Hạn' : 'Thanh Toán Không Thành Công';
  return <div className="min-h-[80vh] flex items-center justify-center p-4 text-text-primary">
    <section className="glass-premium max-w-lg w-full rounded-3xl p-8 md:p-12 text-center border border-border-subtle shadow-2xl" aria-live="polite" aria-busy={checking}>
      <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center border ${paid ? 'border-success/40 bg-success/10 text-success' : pending ? 'border-warning/40 bg-warning/10 text-warning' : 'border-danger/30 bg-danger/10 text-danger'}`}>
        {pending ? <Clock3 className="w-12 h-12" aria-hidden="true" /> : paid ? <CheckCircle2 className="w-12 h-12" aria-hidden="true" /> : <XCircle className="w-12 h-12" aria-hidden="true" />}
      </div>
      <h1 className="mt-6 text-3xl font-display font-black text-white text-balance">{title}</h1>
      <p className="mt-3 text-text-secondary text-sm leading-relaxed">{paid ? 'Vé điện tử đã sẵn sàng trong mục Vé của tôi.' : pending ? 'PayOS hoặc ngân hàng có thể cần thêm thời gian để gửi xác nhận. Không thanh toán lại đơn này.' : 'Giao dịch chưa tạo vé hợp lệ. Bạn có thể quay lại chọn ghế khác.'}</p>
      {orderCode && <p className="mt-3 text-xs text-text-tertiary">Mã đơn hàng: <span className="font-mono font-bold text-brand-primary" translate="no">#{orderCode}</span></p>}
      {error && <p role="alert" className="mt-4 text-xs text-warning">{error}</p>}
      <div className="mt-7 space-y-3">
        {(pending || error) && <button type="button" onClick={() => { attemptRef.current = 0; void checkStatus(); }} disabled={checking} className="w-full py-3 bg-brand-primary hover:opacity-90 disabled:opacity-50 text-white font-bold rounded-xl transition-opacity focus-visible:ring-2 focus-visible:ring-white flex justify-center gap-2"><RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} aria-hidden="true" />{checking ? 'Đang kiểm tra…' : 'Kiểm Tra Lại'}</button>}
        <Link to="/my-tickets" className="w-full py-3 bg-surface-2 hover:bg-surface-3 text-white font-bold rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary flex justify-center gap-2"><Ticket className="w-4 h-4" aria-hidden="true" />Vé Của Tôi</Link>
        <Link to="/" className="w-full py-3 text-text-secondary hover:text-white rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary flex justify-center gap-2">{paid ? <Home className="w-4 h-4" aria-hidden="true" /> : <ArrowRight className="w-4 h-4" aria-hidden="true" />}{paid ? 'Về Trang Chủ' : 'Chọn Sự Kiện Khác'}</Link>
      </div>
    </section>
  </div>;
}
