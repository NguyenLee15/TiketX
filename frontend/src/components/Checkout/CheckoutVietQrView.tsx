import React from 'react';
import { Loader2, Copy, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';

export interface PaymentInfo {
  orderCode?: string | number;
  amount?: number;
  checkoutUrl?: string;
  qrCodeUrl?: string;
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
}

interface CheckoutVietQrViewProps {
  loadingPayment: boolean;
  paymentInitError: string | null;
  paymentData: PaymentInfo | null;
  onRetryPayment: () => void;
  onProceedPayOS: () => void;
  copyToClipboard: (text: string, fieldName: string) => void;
}

export const CheckoutVietQrView: React.FC<CheckoutVietQrViewProps> = React.memo(({
  loadingPayment,
  paymentInitError,
  paymentData,
  onRetryPayment,
  onProceedPayOS,
  copyToClipboard,
}) => {
  const orderCode = paymentData?.orderCode;
  const transferContent = orderCode ? `TICKEX ${orderCode}` : '';
  const qrUrl = paymentData?.qrCodeUrl;
  const hasBankDetails = Boolean(
    paymentData?.bankName?.trim() &&
    paymentData?.accountNumber?.trim() &&
    paymentData?.accountName?.trim()
  );

  if (paymentInitError) {
    return (
      <div className="p-6 rounded-2xl bg-danger/10 border border-danger/30 flex flex-col items-center justify-center text-center space-y-3" role="alert">
        <AlertCircle className="w-8 h-8 text-danger" />
        <h4 className="text-white font-bold text-sm">Không thể tạo mã thanh toán</h4>
        <p className="text-text-secondary text-xs max-w-sm">{paymentInitError}</p>
        <button
          onClick={onRetryPayment}
          className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Thử lại tạo mã thanh toán</span>
        </button>
      </div>
    );
  }

  if (loadingPayment) {
    return (
      <div className="p-8 rounded-2xl bg-surface-2/40 border border-border-subtle flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        <p className="text-text-secondary text-xs">Đang khởi tạo mã QR thanh toán...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* QR Code and Bank Details Box */}
      <div className="p-5 rounded-2xl bg-surface-2/40 border border-border-subtle flex flex-col md:flex-row items-center gap-5">
        <div className="w-36 h-36 bg-white p-2 rounded-2xl shadow-xl shrink-0 flex items-center justify-center border-4 border-surface-3">
          {qrUrl ? (
            <img src={qrUrl} alt="Mã VietQR thanh toán" width="128" height="128" className="w-full h-full object-contain" />
          ) : (
            <span className="text-xs text-slate-500 text-center">Thanh toán qua PayOS</span>
          )}
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
                    className="p-1 hover:text-brand-primary text-text-secondary transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary rounded cursor-pointer"
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

          {transferContent && (
            <div className="flex justify-between items-center p-2 rounded-xl bg-brand-primary/10 border border-brand-primary/30">
              <span className="text-brand-primary font-semibold">Nội dung CK:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-brand-primary">{transferContent}</span>
                <button
                  onClick={() => copyToClipboard(transferContent, 'Nội dung chuyển khoản')}
                  className="p-1 hover:text-white text-brand-primary transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary rounded cursor-pointer"
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

      {/* PayOS Redirect Button */}
      {paymentData?.checkoutUrl && paymentData.checkoutUrl.startsWith('http') && (
        <button 
          onClick={onProceedPayOS}
          className="w-full py-3.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold rounded-lg transition-[background-color,transform] flex items-center justify-center gap-2 group text-sm active:scale-98 focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer shadow-lg shadow-brand-glow"
        >
          <span>Chuyển Đến Cổng Thanh Toán PayOS</span>
          <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
});

