import { useState, useEffect, useRef } from 'react';

interface UseReservationCountdownOptions {
  lockExpiresAt: string | null;
  onExpire?: () => void;
}

export function useReservationCountdown({ lockExpiresAt, onExpire }: UseReservationCountdownOptions) {
  const [timeLeft, setTimeLeft] = useState<number | null>(() => {
    if (!lockExpiresAt) return null;
    const diff = Math.floor((new Date(lockExpiresAt).getTime() - Date.now()) / 1000);
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
      const diff = Math.floor((new Date(lockExpiresAt).getTime() - Date.now()) / 1000);
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
  }, [lockExpiresAt]);

  const minutes = timeLeft !== null ? Math.floor(timeLeft / 60) : 0;
  const seconds = timeLeft !== null ? timeLeft % 60 : 0;
  const formattedTime = timeLeft !== null 
    ? `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : null;

  return { timeLeft, formattedTime, setTimeLeft };
}
