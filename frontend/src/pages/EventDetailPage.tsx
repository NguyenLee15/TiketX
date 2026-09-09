import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Info, Check, Zap, ArrowRight, Clock, ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { EventDetail, Seat, SeatStatus, SeatStatusChangedPayload } from '../types';
import CheckoutModal from '../components/CheckoutModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useSeatSignalR } from '../hooks/useSeatSignalR';
import api from '../services/api';
import { EventInfoCard } from './EventDetail/EventInfoCard';
import { SeatMap } from './EventDetail/SeatMap';
import { SkeletonSeatMap } from '../components/Skeletons/SkeletonSeatMap';
import { formatCurrency } from '../utils/formatters';
import { clearCheckoutState, shouldPreserveSeatSelection } from '../utils/customerState';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [locking, setLocking] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<string | null>(null);

  // Lock timer synchronized with server expiresAt
  const [lockTimeLeft, setLockTimeLeft] = useState<number | null>(null);

  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  // Fetch initial event data
  const fetchEvent = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/events/${id}`);
      if (res.data.success) {
        setEvent(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching event', err);
      toast.error('Không thể tải thông tin sự kiện');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchEvent();
  }, [id]);

  // Handle Real-time Seat Status Updates from SignalR
  const handleSeatStatusChanged = useCallback((payload: SeatStatusChangedPayload & { seatId: string; status: SeatStatus }) => {
    setEvent((prev) => {
      if (!prev) return prev;
      const currentSeat = prev.seats.find(seat => seat.id === payload.seatId);
      if (payload.version && currentSeat?.version && payload.version !== currentSeat.version) {
        void fetchEvent();
        return prev;
      }
      const newSeats = prev.seats.map(seat => 
        seat.id === payload.seatId ? { ...seat, status: payload.status, version: payload.version ?? seat.version, isLockedByMe: payload.isLockedByCurrentUser ?? payload.isLockedByMe } : seat
      );
      return { ...prev, seats: newSeats };
    });

    // If our currently selected seat was locked or bought by someone else
    setSelectedSeat(prev => {
      if (prev?.id === payload.seatId && !shouldPreserveSeatSelection(prev.id, payload)) {
        toast.error(`Ghế ${prev.row}${prev.number} vừa được người khác giữ chỗ!`);
        return null;
      }
      return prev;
    });
  }, []);

  useSeatSignalR(id, handleSeatStatusChanged);

  // Lock timer countdown effect
  useEffect(() => {
    if (lockTimeLeft === null || lockTimeLeft <= 0) return;

    const timer = setInterval(() => {
      setLockTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          toast.error('Hạn giữ chỗ 5 phút đã hết. Ghế đã được tự động mở khóa!', { duration: 5000 });
          setSelectedSeat(null);
          setIsCheckoutOpen(false);
          const cleared = clearCheckoutState();
          setTicketId(cleared.ticketId);
          setLockExpiresAt(cleared.lockExpiresAt);
          fetchEvent(); // Refresh seats status
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockTimeLeft]);

  const handleSeatClick = (seat: Seat) => {
    if (seat.status !== 0) return; // Only allow Available seats
    if (!isAuthenticated()) {
      toast('Vui lòng đăng nhập để chọn ghế và đặt vé.', { icon: '🔐' });
      navigate('/login', { state: { from: location } });
      return;
    }
    
    if (selectedSeat?.id === seat.id) {
      setSelectedSeat(null);
      setLockTimeLeft(null);
    } else {
      setSelectedSeat(seat);
      setLockTimeLeft(null);
    }
  };

  const handleBookTicket = async () => {
    if (!selectedSeat || !event) return;
    setLocking(true);
    try {
      const res = await api.post(`/api/seats/${selectedSeat.id}/lock`, {
        eventId: event.id,
        version: selectedSeat.version
      });

      if (res.data.success) {
        setTicketId(res.data.data.ticketId);
        
        // Sync timer with server expiresAt
        if (res.data.data.expiresAt) {
          setLockExpiresAt(res.data.data.expiresAt);
          const expiresMs = new Date(res.data.data.expiresAt).getTime();
          const remainingSecs = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
          setLockTimeLeft(remainingSecs > 0 ? remainingSecs : 300);
        } else {
          setLockExpiresAt(null);
          setLockTimeLeft(300);
        }

        setIsCheckoutOpen(true);
        toast.success(`Đã giữ ghế ${selectedSeat.row}${selectedSeat.number} thành công!`);
      } else {
        toast.error(res.data.message || 'Không thể giữ ghế này. Vui lòng chọn ghế khác.');
        fetchEvent();
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      const msg = apiErr.response?.data?.message || 'Ghế vừa có người khác đặt trước hoặc đã xảy ra xung đột. Vui lòng chọn ghế khác!';
      toast.error(msg);
      fetchEvent();
    } finally {
      setLocking(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading && !event) {
    return <SkeletonSeatMap />;
  }

  if (!event) {
    return (
      <div className="text-center p-16 glass-premium rounded-3xl mt-8 border border-border-subtle shadow-2xl">
        <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Info className="w-10 h-10 text-danger" />
        </div>
        <h3 className="text-2xl font-display font-bold text-white mb-2">Không Tìm Thấy Sự Kiện</h3>
        <p className="text-text-secondary">Sự kiện bạn yêu cầu không tồn tại hoặc đã kết thúc.</p>
        <Link to="/" className="inline-block mt-6 px-6 py-3 bg-surface-3 hover:bg-surface-2 text-white rounded-xl transition-colors font-medium">
          Quay lại danh sách sự kiện
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-12 relative text-text-primary max-w-7xl mx-auto">
      {/* Background ambient effects */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-[-1] overflow-hidden">
        <div className="absolute top-[-10%] right-[-5%] w-[50vw] h-[50vw] rounded-full bg-brand-primary/10 blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40vw] h-[40vw] rounded-full bg-brand-secondary/10 blur-[140px]" />
      </div>

      <div className="flex items-center justify-between mb-6">
        <Link 
          to="/" 
          className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-surface-2/60 border border-border-subtle text-text-secondary hover:text-white hover:bg-surface-3 transition-colors backdrop-blur-md text-xs sm:text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          <span>Quay lại danh sách</span>
        </Link>

        {/* Live SignalR Status Indicator Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold shadow-sm">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span>SignalR: Đồng Bộ Trực Tuyến</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Col: Event Details & Selected Seat Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <EventInfoCard event={event} />

          {/* Seat Selection Panel */}
          <div className="glass-premium p-5 sm:p-6 rounded-2xl border border-border-subtle shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-[50px] pointer-events-none" />
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-surface-3 flex items-center justify-center text-brand-primary">
                <Check className="w-3.5 h-3.5" />
              </div>
              Thông Tin Ghế Đang Chọn
            </h3>
            
            {selectedSeat ? (
              <div className="space-y-4 animate-slide-up">
                <div className="flex justify-between items-center bg-surface-2/80 p-4 rounded-xl border border-brand-primary/40 shadow-inner relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-brand-primary/15 to-transparent pointer-events-none" />
                  <div className="relative z-10">
                    <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider mb-0.5">Vị trí ghế</p>
                    <p className="text-xl font-black text-white font-display tracking-tight">
                      Hàng {selectedSeat.row} <span className="text-brand-primary">-</span> Ghế {selectedSeat.number}
                    </p>
                  </div>
                  <div className="text-right relative z-10">
                    <p className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider mb-0.5">Giá vé</p>
                    <p className="text-xl font-black text-success font-display tracking-tight">{formatCurrency(selectedSeat.price)}</p>
                  </div>
                </div>

                {/* Lock Countdown Timer Display */}
                {lockTimeLeft !== null && (
                  <div className="p-3 bg-surface-2/90 rounded-xl border border-warning/40 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-warning/20 border border-warning/30 flex items-center justify-center text-warning">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-text-secondary uppercase">Thời gian giữ chỗ</p>
                        <p className="text-[11px] text-warning font-bold">Đang khóa độc quyền</p>
                      </div>
                    </div>
                    <span role="timer" aria-live={lockTimeLeft <= 60 ? 'polite' : undefined} aria-atomic="true" className="text-xl font-mono font-black text-warning bg-warning/10 px-2.5 py-0.5 rounded-lg border border-warning/20">
                      {formatTimer(lockTimeLeft)}
                    </span>
                  </div>
                )}
                
                <button
                  onClick={handleBookTicket}
                  disabled={locking}
                  className="w-full py-3.5 bg-gradient-to-r from-brand-primary to-brand-secondary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-[opacity,transform] shadow-md shadow-brand-glow flex items-center justify-center text-sm group relative overflow-hidden active:scale-98 focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:animate-shimmer" />
                  {locking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Khóa Ghế & Đặt Vé</span>
                      <ArrowRight className="ml-1.5 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
                
                <div className="flex items-start gap-2 bg-warning/10 p-3 rounded-lg border border-warning/20 text-warning text-[11px] font-medium leading-relaxed">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <p>Hệ thống tự động khóa giữ ghế độc quyền cho bạn trong 5 phút để hoàn tất thanh toán an toàn.</p>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 border-2 border-dashed border-border-subtle rounded-xl bg-surface-2/30">
                <div className="w-10 h-10 bg-surface-3 rounded-xl flex items-center justify-center mx-auto mb-2 text-text-tertiary">
                  <Zap className="w-5 h-5 text-brand-primary" />
                </div>
                <p className="text-white font-bold text-xs sm:text-sm mb-0.5">Chưa chọn ghế</p>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Nhấp vào bất kỳ ghế nào trên sơ đồ khán đài bên phải để xem giá và tiến hành giữ chỗ.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Interactive Auditorium Seat Map (8 cols) */}
        <div className="lg:col-span-8">
          <SeatMap 
            seats={event.seats} 
            selectedSeat={selectedSeat} 
            onSeatClick={handleSeatClick} 
          />
        </div>
      </div>

      {isCheckoutOpen && selectedSeat && ticketId && (
        <CheckoutModal 
          seat={selectedSeat}
          event={event}
          ticketId={ticketId}
          expiresAt={lockExpiresAt || undefined}
           onClose={() => {
            setIsCheckoutOpen(false);
            const cleared = clearCheckoutState();
            setTicketId(cleared.ticketId);
            setLockExpiresAt(cleared.lockExpiresAt);
            setLockTimeLeft(cleared.lockTimeLeft);
            setSelectedSeat(null);
            fetchEvent();
          }} 
        />
      )}
    </div>
  );
}
