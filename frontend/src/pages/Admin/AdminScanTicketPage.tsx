import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, CameraOff, CheckCircle2, XCircle, AlertTriangle, 
  Search, RefreshCw, UserCheck, ShieldCheck, Ticket as TicketIcon, 
  Volume2, Clipboard, SwitchCamera
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../../services/api';
import { formatDate } from '../../utils/formatters';

interface ScanResult {
  status: 'valid' | 'already_used' | 'invalid';
  message: string;
  ticket?: {
    ticketId: string;
    eventTitle: string;
    attendeeName: string;
    attendeeEmail?: string;
    row: string;
    number: number;
    tier: number | string;
    price: number;
    orderCode: number;
    checkedInAt?: string;
  };
}

// Singleton Web Audio Context to prevent hardware limit exhaustion
let sharedAudioContext: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioContext = new AudioCtx();
      }
    }
    if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

export default function AdminScanTicketPage() {
  const [ticketInput, setTicketInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);

  // Camera state
  const [cameraActive, setCameraActive] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // In-flight lock and debounce refs
  const isProcessingRef = useRef(false);
  const lastScannedTokenRef = useRef('');
  const lastScannedTimeRef = useRef(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const playAudioFeedback = (isSuccess: boolean) => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (isSuccess) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch { }
  };

  const handleVerifyTicket = useCallback(async (rawToken: string) => {
    const trimmed = rawToken.trim();
    if (!trimmed) return;

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsVerifying(true);

    try {
      // Validate structure before making HTTP request
      if (!trimmed.includes('.') && !trimmed.startsWith('{')) {
        playAudioFeedback(false);
        const result: ScanResult = {
          status: 'invalid',
          message: 'Mã vé không đúng định dạng chữ ký số (payload.signature).'
        };
        setScanResult(result);
        setRecentScans(prev => [result, ...prev.slice(0, 9)]);
        toast.error('Mã vé không đúng định dạng chữ ký số hợp lệ.');
        return;
      }

      const response = await api.post('/api/tickets/check-in', { qrToken: trimmed });

      if (response.data.success) {
        playAudioFeedback(true);
        const data = response.data.data;
        const result: ScanResult = {
          status: 'valid',
          message: 'VÉ HỢP LỆ — XÁC NHẬN CHO VÀO CỬA SỰ KIỆN',
          ticket: data
        };
        setScanResult(result);
        setRecentScans(prev => [result, ...prev.slice(0, 9)]);
        toast.success(`Check-in thành công: ${data.attendeeName} - Ghế ${data.row}${data.number}`);
        setTicketInput('');
      }
    } catch (err: unknown) {
      playAudioFeedback(false);
      const apiErr = err as { response?: { status?: number; data?: { message?: string; code?: string } }; message?: string };
      const code = apiErr.response?.data?.code;
      const msg = apiErr.response?.data?.message || (apiErr.message === 'Network Error' ? 'Mất kết nối mạng tới máy chủ.' : 'Vé không hợp lệ hoặc đã bị hủy.');

      if (code === 'TICKET_ALREADY_USED') {
        const result: ScanResult = {
          status: 'already_used',
          message: msg
        };
        setScanResult(result);
        setRecentScans(prev => [result, ...prev.slice(0, 9)]);
        toast.error(msg, { duration: 4000 });
      } else {
        const result: ScanResult = {
          status: 'invalid',
          message: msg
        };
        setScanResult(result);
        setRecentScans(prev => [result, ...prev.slice(0, 9)]);
        toast.error(msg, { duration: 4000 });
      }
    } finally {
      setIsVerifying(false);
      isProcessingRef.current = false;
    }
  }, []);

  // Initialize and manage Html5Qrcode instance
  useEffect(() => {
    let mounted = true;
    const elementId = 'tickex-qr-reader';

    if (!cameraActive) {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {}).finally(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          });
        } else {
          scannerRef.current.clear();
          scannerRef.current = null;
        }
      }
      return;
    }

    const timer = setTimeout(async () => {
      if (!mounted) return;
      setCameraError(null);

      try {
        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          (decodedText) => {
            const now = Date.now();
            if (isProcessingRef.current) return;
            if (lastScannedTokenRef.current === decodedText && now - lastScannedTimeRef.current < 2500) {
              return; // Cooldown 2.5s for same token
            }
            lastScannedTokenRef.current = decodedText;
            lastScannedTimeRef.current = now;
            handleVerifyTicket(decodedText);
          },
          () => {
            // Per-frame error when QR not detected in frame; ignore
          }
        );
      } catch (err: unknown) {
        if (!mounted) return;
        const errMsg = (err instanceof Error ? err.message : String(err)) || 'Không thể truy cập camera.';
        console.warn('Camera start error:', errMsg);
        setCameraError(errMsg.includes('NotAllowedError') 
          ? 'Trình duyệt bị từ chối quyền truy cập camera. Vui lòng cấp quyền trong cài đặt trình duyệt.' 
          : 'Không thể khởi tạo camera. Vui lòng kiểm tra thiết bị hoặc chuyển sang nhập tay.');
      }
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {}).finally(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          });
        } else {
          scannerRef.current.clear();
          scannerRef.current = null;
        }
      }
    };
  }, [cameraActive, facingMode, handleVerifyTicket]);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTicketInput(text);
        handleVerifyTicket(text);
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

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500 text-text-primary max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-2/30 p-5 sm:p-6 rounded-2xl border border-border-subtle backdrop-blur-md">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Trạm Soát Vé An Ninh Cổng
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Trạm Soát Vé Điện Tử</h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
            Xác thực chữ ký số HMAC-SHA256 thời gian thực qua Camera WebRTC, ngăn chặn vé giả và quét trùng.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-3 border border-border-subtle text-xs text-text-secondary shrink-0">
          <Volume2 className="w-4 h-4 text-brand-primary" />
          <span>Âm thanh Web Audio Singleton</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Camera Scanner & Quick Input */}
        <div className="lg:col-span-7 space-y-5">
          <div className="glass-card p-5 sm:p-6 rounded-2xl border border-border-subtle relative overflow-hidden">
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
                        onClick={() => { setCameraError(null); setCameraActive(true); }}
                        className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
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
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyTicket(ticketInput)}
                    placeholder="Dán chuỗi token chữ ký số mã QR (payload.signature)..."
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus:border-brand-primary/50 font-mono"
                  />
                </div>
                <button
                  onClick={() => handleVerifyTicket(ticketInput)}
                  disabled={isVerifying || !ticketInput.trim()}
                  className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-md shadow-brand-glow text-xs sm:text-sm active:scale-95"
                >
                  {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                  Soát Vé
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Scan Result Card & Recent History */}
        <div className="lg:col-span-5 space-y-5">
          {/* Scan Result Card with ARIA live region */}
          <div 
            role="status" 
            aria-live="assertive"
            className="glass-card p-5 sm:p-6 rounded-2xl border border-border-subtle min-h-[220px] flex flex-col justify-center relative overflow-hidden"
          >
            {scanResult ? (
              <div className="space-y-3.5 animate-in zoom-in-95 duration-300">
                {scanResult.status === 'valid' && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center space-y-1.5">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
                    <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wide">{scanResult.message}</h3>
                  </div>
                )}

                {scanResult.status === 'already_used' && (
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center space-y-1.5">
                    <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
                    <h3 className="text-xs font-black text-amber-400 uppercase tracking-wide">{scanResult.message}</h3>
                  </div>
                )}

                {scanResult.status === 'invalid' && (
                  <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-center space-y-1.5">
                    <XCircle className="w-10 h-10 text-red-400 mx-auto" />
                    <h3 className="text-xs font-black text-red-400 uppercase tracking-wide">{scanResult.message}</h3>
                  </div>
                )}

                {/* Ticket Details Box */}
                {scanResult.ticket && (
                  <div className="bg-surface-2 p-3.5 rounded-xl border border-border-subtle space-y-2 text-xs">
                    <div className="flex justify-between items-center pb-1.5 border-b border-border-subtle">
                      <span className="text-text-secondary">Khách Hàng:</span>
                      <span className="font-bold text-white text-sm">{scanResult.ticket.attendeeName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary">Sự Kiện:</span>
                      <span className="font-medium text-white line-clamp-1">{scanResult.ticket.eventTitle}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary">Vị Trí Ghế:</span>
                      <span className="font-bold text-brand-primary text-sm">
                        Hàng {scanResult.ticket.row} - Ghế {scanResult.ticket.number}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary">Mã Đơn Hàng:</span>
                      <span className="font-mono text-text-tertiary">#{scanResult.ticket.orderCode}</span>
                    </div>
                    {scanResult.ticket.checkedInAt && (
                      <div className="flex justify-between items-center pt-1.5 border-t border-border-subtle text-text-tertiary text-[11px]">
                        <span>Thời gian Check-in:</span>
                        <span>{formatDate(scanResult.ticket.checkedInAt ?? '', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-text-secondary">
                <TicketIcon className="w-10 h-10 text-surface-3 mx-auto mb-2.5" />
                <p className="text-sm font-semibold text-white">Sẵn Sàng Soát Vé</p>
                <p className="text-xs mt-0.5">Kết quả xác thực vé sẽ xuất hiện tại đây sau khi quét.</p>
              </div>
            )}
          </div>

          {/* Recent Scans History Log */}
          <div className="glass-card p-5 sm:p-6 rounded-2xl border border-border-subtle">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-brand-primary" />
              Lịch sử soát vé gần nhất
            </h3>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {recentScans.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-surface-2/40 rounded-xl border border-border-subtle flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 truncate">
                    {item.status === 'valid' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    {item.status === 'already_used' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                    {item.status === 'invalid' && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                    <div className="truncate">
                      <p className="font-bold text-white truncate">{item.ticket?.attendeeName || 'Từ chối vào cổng'}</p>
                      <p className="text-[10px] text-text-secondary truncate">
                        {item.ticket ? `Hàng ${item.ticket.row} - Ghế ${item.ticket.number}` : item.message}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                    item.status === 'valid' ? 'bg-emerald-500/10 text-emerald-400' :
                    item.status === 'already_used' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {item.status === 'valid' ? 'Hợp Lệ' : item.status === 'already_used' ? 'Đã Quét' : 'Từ Chối'}
                  </span>
                </div>
              ))}

              {recentScans.length === 0 && (
                <p className="text-xs text-text-secondary text-center py-4">Chưa có lượt quét nào trong phiên này.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
