import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/formatters';
import { Loader2, ShieldCheck, CreditCard, Building2, Smartphone } from 'lucide-react';
import api from '../services/api';

export default function MockPayOSPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [amount, setAmount] = useState(0);

  const orderCode = searchParams.get('orderCode');

  if (!import.meta.env.DEV) {
    return (
      <div className="min-h-screen bg-surface-1 flex items-center justify-center p-4">
        <div className="surface-panel p-8 text-center max-w-md w-full">
          <h2 className="text-xl font-bold text-danger-readable mb-2">Không khả dụng</h2>
          <p className="text-text-secondary mb-6">Trang mô phỏng thanh toán này chỉ có sẵn trong môi trường phát triển.</p>
          <button onClick={() => navigate('/')} className="btn-primary w-full">Trở Về Trang Chủ</button>
        </div>
      </div>
    );
  }
  
  useEffect(() => {
    if (orderCode) api.get(`/api/payments/status/${encodeURIComponent(orderCode)}`).then(res => setAmount(res.data?.data?.amount ?? res.data?.data?.price ?? 0));
  }, [orderCode]);

  const handleSimulatePayment = async (isSuccess: boolean) => {
    setStatus('processing');
    
    try {
      if (isSuccess) await api.post(`/api/payments/simulate-success/${encodeURIComponent(orderCode || '')}`);

      // 2. Wait a bit for dramatic effect
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setStatus(isSuccess ? 'success' : 'error');

      // 3. Redirect user back
      setTimeout(() => {
        window.location.href = `/payment/result?orderCode=${encodeURIComponent(orderCode || '')}`;
      }, 1500);

    } catch {
      setStatus('error');
    }
  };

  if (!orderCode) {
    return (
      <div className="min-h-screen bg-surface-1 flex items-center justify-center p-4">
        <div className="surface-panel p-8 text-center max-w-md w-full">
          <h2 className="text-xl font-bold text-danger-readable mb-2">Phiên Giao Dịch Không Hợp Lệ</h2>
          <p className="text-text-secondary mb-6">Thiếu thông tin mã đơn hàng thanh toán.</p>
          <button onClick={() => navigate('/')} className="btn-primary w-full">Trở Về Trang Chủ</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-slate-800 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm py-4 px-6 flex justify-between items-center border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-xl">P</span>
          </div>
          <span className="font-bold text-xl text-blue-900">Cổng Thử Nghiệm PayOS</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          Môi Trường Thử Nghiệm Sandbox
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="bg-white max-w-4xl w-full rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
          
          {/* Left: QR/Payment Form */}
          <div className="p-8 md:w-[60%] border-b md:border-b-0 md:border-r border-gray-100 flex flex-col">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Thanh toán đơn hàng</h1>
              <p className="text-gray-500 text-sm">Mã đơn: <span className="font-mono font-medium text-gray-700">#{orderCode}</span></p>
            </div>

            {status === 'idle' ? (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl p-8 bg-gray-50 relative overflow-hidden group">
                <div className="w-48 h-48 bg-white shadow-sm border border-gray-200 rounded-xl flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-4 border border-blue-100 rounded-lg" />
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=payos-sandbox" alt="QR Code" className="w-[85%] h-[85%] opacity-50 grayscale mix-blend-multiply" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">CHẾ ĐỘ THỬ NGHIỆM</span>
                  </div>
                </div>
                
                <h3 className="font-bold text-gray-800 text-lg mb-2">Quét mã để thanh toán</h3>
                <p className="text-gray-500 text-sm text-center mb-8 max-w-xs">Sử dụng Ứng dụng Ngân hàng hoặc Ví điện tử để quét mã này.</p>

                <div className="w-full space-y-3">
                  <button 
                    onClick={() => handleSimulatePayment(true)}
                    className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors shadow-md shadow-green-500/20"
                  >
                    Mô phỏng: Thanh toán Thành công
                  </button>
                  <button 
                    onClick={() => handleSimulatePayment(false)}
                    className="w-full py-3.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition-colors border border-red-200"
                  >
                    Mô phỏng: Hủy Thanh toán
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
                {status === 'processing' && (
                  <>
                    <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Đang xử lý giao dịch...</h3>
                    <p className="text-gray-500">Hệ thống đang xác nhận thanh toán của bạn.</p>
                  </>
                )}
                {status === 'success' && (
                  <>
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                      <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Thanh toán thành công!</h3>
                    <p className="text-gray-500">Đang chuyển hướng về cửa hàng...</p>
                  </>
                )}
                {status === 'error' && (
                  <>
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                      <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Thanh toán thất bại</h3>
                    <p className="text-gray-500">Đang quay lại...</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right: Order Summary */}
          <div className="p-8 md:w-[40%] bg-gray-50/50">
            <h3 className="text-gray-500 font-semibold uppercase tracking-wider text-xs mb-6">Thông tin Đơn hàng</h3>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center pb-4 border-b border-gray-200 border-dashed">
                <span className="text-gray-600">Mã đơn hàng</span>
                <span className="font-mono font-medium text-gray-900">#{orderCode}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-gray-200 border-dashed">
                <span className="text-gray-600">Nhà cung cấp</span>
                <span className="font-bold text-gray-900">TickeX Platform</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-gray-200 border-dashed">
                <span className="text-gray-600">Nội dung</span>
                <span className="font-medium text-gray-900 text-right max-w-[150px] truncate">Thanh toan ve TickeX</span>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-5 border border-blue-100 mb-8">
              <div className="flex justify-between items-center mb-1">
                <span className="text-blue-900 font-medium">Số tiền thanh toán</span>
              </div>
              <div className="text-3xl font-black text-blue-600">
                {formatCurrency(amount)}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hình thức thanh toán</h4>
              <div className="flex gap-2">
                <div className="w-12 h-10 bg-white border border-gray-200 rounded flex items-center justify-center shadow-sm">
                  <CreditCard className="w-5 h-5 text-gray-400" />
                </div>
                <div className="w-12 h-10 bg-white border border-gray-200 rounded flex items-center justify-center shadow-sm">
                  <Building2 className="w-5 h-5 text-gray-400" />
                </div>
                <div className="w-12 h-10 bg-white border border-gray-200 rounded flex items-center justify-center shadow-sm">
                  <Smartphone className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-gray-400 text-sm">
        <p>Cổng thanh toán giả lập dành cho TickeX Portfolio.</p>
      </footer>
    </div>
  );
}
