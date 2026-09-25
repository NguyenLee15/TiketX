import { useState, useCallback, useRef } from 'react';
import { ShieldCheck, Volume2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { scanTicketDataSchema } from '../../schemas/adminSchemas';
import { ScanCameraPanel } from './Scan/ScanCameraPanel';
import { ScanResultDisplay, ScanResult } from './Scan/ScanResultDisplay';
import { RecentScansList } from './Scan/RecentScansList';
import { playAudioFeedback } from './Scan/scanAudioFeedback';

export default function AdminScanTicketPage() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);
  const isProcessingRef = useRef(false);

  const handleVerifyTicket = useCallback(async (rawToken: string) => {
    const trimmed = rawToken.trim();
    if (!trimmed) return;

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsVerifying(true);

    try {
      // Validate structure before making HTTP request
      if (!trimmed.includes('.') && !trimmed.startsWith('{')) {
        playAudioFeedback('failure');
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

      if (response.data?.success) {
        const parsed = scanTicketDataSchema.safeParse(response.data.data);
        if (parsed.success) {
          playAudioFeedback('success');
          const data = parsed.data;
          const result: ScanResult = {
            status: 'valid',
            message: 'VÉ HỢP LỆ — XÁC NHẬN CHO VÀO CỬA SỰ KIỆN',
            ticket: data
          };
          setScanResult(result);
          setRecentScans(prev => [result, ...prev.slice(0, 9)]);
          toast.success(`Check-in thành công: ${data.attendeeName} - Ghế ${data.row}${data.number}`);
        } else {
          playAudioFeedback('failure');
          const result: ScanResult = {
            status: 'invalid',
            message: 'Dữ liệu vé từ máy chủ không đúng định dạng.'
          };
          setScanResult(result);
          setRecentScans(prev => [result, ...prev.slice(0, 9)]);
          toast.error('Dữ liệu vé từ máy chủ không hợp lệ.');
        }
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { message?: string; code?: string } }; message?: string; code?: string };
      const isNetworkError = !apiErr.response || apiErr.message === 'Network Error' || apiErr.code === 'ERR_NETWORK' || apiErr.code === 'ECONNABORTED';

      if (isNetworkError) {
        playAudioFeedback('warning');
        const netMsg = 'Mất kết nối máy chủ khi soát vé. Vui lòng kiểm tra đường truyền và thử lại.';
        const result: ScanResult = {
          status: 'conflict',
          message: netMsg
        };
        setScanResult(result);
        setRecentScans(prev => [result, ...prev.slice(0, 9)]);
        toast.error(netMsg, { duration: 5000 });
        return;
      }

      const code = apiErr.response?.data?.code;
      const msg = apiErr.response?.data?.message || 'Vé không hợp lệ hoặc đã bị hủy.';

      if (code === 'TICKET_ALREADY_USED') {
        playAudioFeedback('warning');
        const result: ScanResult = {
          status: 'already_used',
          message: msg
        };
        setScanResult(result);
        setRecentScans(prev => [result, ...prev.slice(0, 9)]);
        toast.error(msg, { duration: 4000 });
      } else if (code === 'CHECKIN_CONCURRENCY_CONFLICT' || apiErr.response?.status === 409) {
        playAudioFeedback('warning');
        const result: ScanResult = {
          status: 'conflict',
          message: msg
        };
        setScanResult(result);
        setRecentScans(prev => [result, ...prev.slice(0, 9)]);
        toast.error(msg, { duration: 5000 });
      } else {
        playAudioFeedback('failure');
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

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-500 text-text-primary max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="surface-panel flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 sm:p-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Trạm Soát Vé An Ninh Cổng
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Trạm Soát Vé Điện Tử</h1>
          <p className="text-text-secondary text-xs sm:text-sm mt-0.5">
            Xác thực chữ ký số HMAC-SHA256 thời gian thực qua Camera WebRTC, phát hiện xung đột và ngăn chặn vé giả.
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
          <ScanCameraPanel onScanToken={handleVerifyTicket} isVerifying={isVerifying} />
        </div>

        {/* Right Column: Scan Result Card & Recent History */}
        <div className="lg:col-span-5 space-y-5">
          <ScanResultDisplay scanResult={scanResult} />
          <RecentScansList recentScans={recentScans} />
        </div>
      </div>
    </div>
  );
}
