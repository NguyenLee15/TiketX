import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, SwitchCamera, Clipboard, AlertTriangle, Search, RefreshCw, UserCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { Html5Qrcode } from 'html5-qrcode';

interface ScanCameraPanelProps {
  onScanToken: (rawToken: string) => void;
  isVerifying: boolean;
}

export const ScanCameraPanel: React.FC<ScanCameraPanelProps> = ({ onScanToken, isVerifying }) => {
  const [ticketInput, setTicketInput] = useState('');
  const [cameraActive, setCameraActive] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const verifyingRef = useRef(isVerifying);
  verifyingRef.current = isVerifying;
  const stopRef = useRef<Promise<void>>(Promise.resolve());
  const lastScannedTokenRef = useRef('');
  const lastScannedTimeRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let startCancelled = false;
    let ownedScanner: Html5Qrcode | null = null;
    let startup: Promise<unknown> | null = null;
    const elementId = 'tickex-qr-reader';

    if (!cameraActive) {
      return;
    }

    const timer = setTimeout(async () => {
      if (!mounted) return;
      setCameraError(null);

      try {
        await stopRef.current;
        if (!mounted || startCancelled) return;
        const { Html5Qrcode: Html5QrcodeCtor } = await import('html5-qrcode');
        if (!mounted || startCancelled) return;
        const scanner = new Html5QrcodeCtor(elementId);
        ownedScanner = scanner;
        scannerRef.current = scanner;

        startup = scanner.start(
          { facingMode },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            const now = Date.now();
            if (!mounted || startCancelled || verifyingRef.current) return;
            if (lastScannedTokenRef.current === decodedText && now - lastScannedTimeRef.current < 2500) {
              return; // Cooldown 2.5s for same token
            }
            lastScannedTokenRef.current = decodedText;
            lastScannedTimeRef.current = now;
            onScanToken(decodedText);
          },
          () => {
            // Per-frame error when QR not detected in frame; ignore
          }
        );
        await startup;
      } catch (err: unknown) {
        if (!mounted) return;
        const errMsg = (err instanceof Error ? err.message : String(err)) || 'Không thể truy cập camera.';
        setCameraError(errMsg.includes('NotAllowedError') 
          ? 'Trình duyệt bị từ chối quyền truy cập camera. Vui lòng cấp quyền trong cài đặt trình duyệt.' 
          : 'Không thể khởi tạo camera. Vui lòng kiểm tra thiết bị hoặc chuyển sang nhập tay.');
      }
    }, 150);

    return () => {
      mounted = false;
      startCancelled = true;
      clearTimeout(timer);
      const scanner = ownedScanner;
      if (scanner) {
          stopRef.current = (startup ?? Promise.resolve()).catch(() => undefined).then(async () => {
            if (scanner.isScanning) await scanner.stop();
            scanner.clear();
            if (scannerRef.current === scanner) scannerRef.current = null;
          });
          // Keep teardown failure observable by the next startup without an unhandled rejection on unmount.
          void stopRef.current.catch(() => undefined);
      }
    };
  }, [cameraActive, facingMode, onScanToken, retryNonce]);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTicketInput(text);
        onScanToken(text);
      }
    } catch {
      toast.error('Không thể đọc dữ liệu từ bộ nhớ tạm.');
    }
  };

  const toggleCamera = () => {
    setCameraActive(prev => !prev);
  };

  const switchCameraFacing = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleManualSubmit = () => {
    const trimmed = ticketInput.trim();
    if (!trimmed) return;
    onScanToken(trimmed);
  };

  return (
    <div className="surface-panel p-5 sm:p-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Camera className="w-4 h-4 text-brand-primary" />
          Khung Quét Camera Trực Tiếp
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={switchCameraFacing}
            disabled={!cameraActive}
            aria-label="Đổi camera trước sau"
            title="Đổi camera Trước / Sau"
            className="p-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-secondary hover:text-white border border-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary active:scale-95 disabled:opacity-40"
          >
            <SwitchCamera className="w-4 h-4 text-brand-primary" />
          </button>
          <button
            onClick={toggleCamera}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary active:scale-95 ${
              cameraActive 
                ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' 
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            {cameraActive ? (
              <><CameraOff className="w-3.5 h-3.5" /> Tắt Camera</>
            ) : (
              <><Camera className="w-3.5 h-3.5" /> Bật Camera</>
            )}
          </button>
          <button 
            onClick={handlePasteClipboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-xs text-text-secondary hover:text-white border border-border-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary active:scale-95"
          >
            <Clipboard className="w-3.5 h-3.5 text-brand-primary" />
            Dán Clipboard
          </button>
        </div>
      </div>

      {/* Video Viewfinder Container */}
      <div className="relative w-full min-h-[260px] sm:min-h-[300px] rounded-xl bg-surface-1 border-2 border-dashed border-brand-primary/40 flex flex-col items-center justify-center overflow-hidden shadow-inner">
        {cameraActive ? (
          <>
            <div id="tickex-qr-reader" className="w-full h-full max-w-sm overflow-hidden" />
            {cameraError && (
              <div className="absolute inset-0 bg-surface-1/95 p-6 flex flex-col items-center justify-center text-center space-y-3">
                <AlertTriangle className="w-10 h-10 text-amber-400" />
                <p className="text-sm font-semibold text-white">{cameraError}</p>
                <button
                  onClick={() => { setCameraError(null); setCameraActive(true); setRetryNonce(n => n + 1); }}
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-secondary text-surface-0 rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  Thử lại kết nối
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center text-text-secondary space-y-2">
            <CameraOff className="w-12 h-12 text-surface-3" />
            <p className="text-sm font-medium text-white">Camera đang tạm dừng</p>
            <p className="text-xs max-w-xs">Bấm "Bật Camera" để mở luồng quét hoặc sử dụng ô nhập tay phía dưới.</p>
          </div>
        )}
      </div>

      {/* Manual Input Form */}
      <div className="mt-4 space-y-2">
        <label htmlFor="qr-token-input" className="block text-xs font-bold text-text-secondary uppercase">
          Nhập Token Chữ Ký Số QR Thủ Công
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input 
              id="qr-token-input"
              type="text"
              value={ticketInput}
              onChange={(e) => setTicketInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
              placeholder="Dán chuỗi token chữ ký số mã QR (payload.signature)..."
              className="w-full bg-surface-2 border border-border-subtle rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary/50 font-mono"
            />
          </div>
          <button
            onClick={handleManualSubmit}
            disabled={isVerifying || !ticketInput.trim()}
            className="px-5 py-2.5 bg-brand-primary hover:bg-brand-secondary text-surface-0 font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-md shadow-brand-glow text-xs sm:text-sm active:scale-95"
          >
            {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
            Soát Vé
          </button>
        </div>
      </div>
    </div>
  );
};
