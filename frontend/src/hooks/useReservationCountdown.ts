import { useState, useEffect, useRef } from 'react';

interface UseReservationCountdownOptions {
  lockExpiresAt: string | null;
  serverTime?: string | null;
  onExpire?: () => void;
}

export function useReservationCountdown({ lockExpiresAt, serverTime, onExpire }: UseReservationCountdownOptions) {
  const clockOffsetMs = useRef<number>(0);
  if (serverTime) {
    const serverTimestamp = new Date(serverTime).getTime();
    if (!Number.isNaN(serverTimestamp)) {
      clockOffsetMs.current = serverTimestamp - Date.now();
    }
  }

  const [timeLeft, setTimeLeft] = useState<number | null>(() => {
    if (!lockExpiresAt) return null;
    const now = Date.now() + clockOffsetMs.current;
    const diff = Math.floor((new Date(lockExpiresAt).getTime() - now) / 1000);
    return diff > 0 ? diff : null;
  });

  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!lockExpiresAt) {
      setTimeLeft(null);
      return;
    }

    const calculateSecondsLeft = () => {
      const now = Date.now() + clockOffsetMs.current;
      const diff = Math.floor((new Date(lockExpiresAt).getTime() - now) / 1000);
      return Math.max(0, diff);
    };

    const initial = calculateSecondsLeft();
    if (initial <= 0) {
      setTimeLeft(null);
      onExpireRef.current?.();
      return;
    }

    setTimeLeft(initial);

    const interval = setInterval(() => {
      const remaining = calculateSecondsLeft();
      if (remaining <= 0) {
        clearInterval(interval);
        setTimeLeft(null);
        onExpireRef.current?.();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockExpiresAt, serverTime]);

  const minutes = timeLeft !== null ? Math.floor(timeLeft / 60) : 0;
  const seconds = timeLeft !== null ? timeLeft % 60 : 0;
  const formattedTime = timeLeft !== null 
    ? `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : null;

  return { timeLeft, formattedTime, setTimeLeft };
}
