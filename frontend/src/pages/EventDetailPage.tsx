import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { EventDetail, Seat, SeatStatus, SeatStatusChangedPayload } from '../types';
import CheckoutModal from '../components/CheckoutModal';
import { useAuthStore } from '../stores/useAuthStore';
import { useSeatSignalR } from '../hooks/useSeatSignalR';
import api from '../services/api';
import { EventInfoCard } from './EventDetail/EventInfoCard';
import { SeatMap } from './EventDetail/SeatMap';
import { SelectedSeatPanel } from './EventDetail/SelectedSeatPanel';
import { SkeletonSeatMap } from '../components/Skeletons/SkeletonSeatMap';
import { clearCheckoutState, shouldPreserveSeatSelection } from '../utils/customerState';
import { useReservationCountdown } from '../hooks/useReservationCountdown';
import { useEventDetailQuery } from '../hooks/useCustomerQueries';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();

  const {
    data: event,
    isLoading: loading,
    isError: loadError,
    refetch: refetchEvent,
  } = useEventDetailQuery(id);

  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [locking, setLocking] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [lockExpiresAt, setLockExpiresAt] = useState<string | null>(null);

  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const bookingIdempotencyKeyRef = useRef<string | null>(null);

  // Reset seat selection & checkout states when switching between event routes
  useEffect(() => {
    setSelectedSeat(null);
    setIsCheckoutOpen(false);
    bookingIdempotencyKeyRef.current = null;
    const cleared = clearCheckoutState();
    setTicketId(cleared.ticketId);
    setLockExpiresAt(cleared.lockExpiresAt);
  }, [id]);

  // Lock expiration callback
  const handleLockExpire = useCallback(() => {
    toast.error('Hạn giữ chỗ 5 phút đã hết. Ghế đã được tự động mở khóa!', { duration: 5000 });
    setSelectedSeat(null);
    setIsCheckoutOpen(false);
    bookingIdempotencyKeyRef.current = null;
    const cleared = clearCheckoutState();
    setTicketId(cleared.ticketId);
    setLockExpiresAt(cleared.lockExpiresAt);
    void refetchEvent();
  }, [refetchEvent]);

  // Lock timer synchronized with server expiresAt
  const { timeLeft: lockTimeLeft, setTimeLeft: setLockTimeLeft } = useReservationCountdown({
    lockExpiresAt,
    onExpire: handleLockExpire
  });

  // Handle Real-time Seat Status Updates from SignalR
  const handleSeatStatusChanged = useCallback((payload: SeatStatusChangedPayload & { seatId: string; status: SeatStatus }) => {
    queryClient.setQueryData<EventDetail>(['events', 'detail', id], (prev) => {
      if (!prev) return prev;
      const seats = prev.seats ?? [];
      const currentSeat = seats.find(seat => seat.id === payload.seatId);
      if (payload.version && currentSeat?.version && payload.version !== currentSeat.version) {
        void refetchEvent();
        return prev;
      }
      const newSeats = seats.map(seat => 
        seat.id === payload.seatId ? { ...seat, status: payload.status, version: payload.version ?? seat.version, isLockedByMe: payload.isLockedByCurrentUser ?? payload.isLockedByMe } : seat
      );
      return { ...prev, seats: newSeats };
    });

    // If our currently selected seat was locked or bought by someone else
    setSelectedSeat(prev => {
      if (prev?.id === payload.seatId && !shouldPreserveSeatSelection(prev.id, payload, user?.id)) {
        return null;
      }
      return prev;
    });
  }, [id, queryClient, refetchEvent, user?.id]);

  const handleSeatReconnect = useCallback(() => {
    void refetchEvent();
  }, [refetchEvent]);

  const { status: seatConnectionStatus, retry: retrySeatConnection } = useSeatSignalR(
    id,
    handleSeatStatusChanged,
    handleSeatReconnect
  );

  const handleSeatClick = (seat: Seat) => {
    if (seat.status !== 0) return; // Only allow Available seats
    if (!isAuthenticated()) {
      toast('Vui lòng đăng nhập để chọn ghế và đặt vé.', { icon: '🔐' });
      navigate('/login', { state: { from: location } });
      return;
    }
    
    bookingIdempotencyKeyRef.current = null;
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

    if (!bookingIdempotencyKeyRef.current) {
      bookingIdempotencyKeyRef.current = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
    }

    try {
      const res = await api.post(`/api/seats/${selectedSeat.id}/lock`, {
        eventId: event.id,
        version: selectedSeat.version
      }, {
        headers: {
          'Idempotency-Key': bookingIdempotencyKeyRef.current
        }
      });

      if (res.data.success) {
        bookingIdempotencyKeyRef.current = null;
        setTicketId(res.data.data.ticketId);
        
        // Sync timer with server expiresAt
        if (res.data.data.expiresAt) {
          const expiresMs = new Date(res.data.data.expiresAt).getTime();
          const remainingSecs = Math.floor((expiresMs - Date.now()) / 1000);
          if (remainingSecs <= 0) {
            setTicketId(null);
            setLockExpiresAt(null);
            setLockTimeLeft(0);
            setIsCheckoutOpen(false);
            toast.error('Thời gian giữ chỗ đã hết hạn. Vui lòng chọn lại ghế.');
            void refetchEvent();
            return;
          }
          setLockExpiresAt(res.data.data.expiresAt);
          setLockTimeLeft(remainingSecs);
        } else {
          setLockExpiresAt(null);
          setLockTimeLeft(300);
        }

        setIsCheckoutOpen(true);
        toast.success(`Đã giữ ghế ${selectedSeat.row}${selectedSeat.number} thành công!`);
      } else {
        toast.error(res.data.message || 'Không thể giữ ghế này. Vui lòng chọn ghế khác.');
        void refetchEvent();
      }
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { message?: string } } };
      const msg = apiErr.response?.data?.message || 'Ghế vừa có người khác đặt trước hoặc đã xảy ra xung đột. Vui lòng chọn ghế khác!';
      toast.error(msg);
      void refetchEvent();
    } finally {
      setLocking(false);
    }
  };

  if (loading && !event) {
    return <SkeletonSeatMap />;
  }

  if (!event) {
    return (
      <div className="text-center p-16 surface-panel mt-8">
        <div className="w-20 h-20 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Info className="w-10 h-10 text-danger" aria-hidden="true" />
        </div>
        <h3 className="text-2xl font-display font-bold text-white mb-2">{loadError ? 'Không thể tải sự kiện' : 'Không tìm thấy sự kiện'}</h3>
        <p className="text-text-secondary">Kiểm tra kết nối rồi thử lại.</p>
        <button type="button" onClick={() => void refetchEvent()} className="inline-flex mt-6 px-6 py-3 bg-brand-primary text-white rounded-xl font-medium focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer">Thử lại</button>
        <Link to="/" className="inline-block mt-6 px-6 py-3 bg-surface-3 hover:bg-surface-2 text-white rounded-xl transition-colors font-medium">
          Quay lại danh sách sự kiện
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-12 relative text-text-primary max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link 
          to="/" 
          className="inline-flex min-h-11 items-center px-3.5 rounded-xl bg-surface-2 border border-border-subtle text-text-secondary hover:text-white hover:bg-surface-3 transition-colors text-xs sm:text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
          <span>Quay lại danh sách</span>
        </Link>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 border border-border-subtle text-text-secondary text-xs font-semibold" role="status" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${seatConnectionStatus === 'connected' ? 'bg-success' : seatConnectionStatus === 'connecting' || seatConnectionStatus === 'reconnecting' ? 'bg-warning' : 'bg-danger'}`} aria-hidden="true" />
          <span>{seatConnectionStatus === 'connected' ? 'Đã đồng bộ ghế' : seatConnectionStatus === 'connecting' || seatConnectionStatus === 'reconnecting' ? 'Đang kết nối ghế' : 'Chưa đồng bộ ghế'}</span>
          {seatConnectionStatus === 'disconnected' && <button type="button" onClick={retrySeatConnection} className="underline underline-offset-2 hover:text-white">Thử lại</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Col: Event Details & Selected Seat Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          <EventInfoCard event={event} />

          {/* Seat Selection Panel */}
          <SelectedSeatPanel
            selectedSeat={selectedSeat}
            lockTimeLeft={lockTimeLeft}
            locking={locking}
            onBookTicket={handleBookTicket}
          />
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
            void refetchEvent();
          }} 
        />
      )}
    </div>
  );
}
