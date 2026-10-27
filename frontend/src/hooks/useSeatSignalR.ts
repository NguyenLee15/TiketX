import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { SeatStatus, SeatStatusChangedPayload } from '../types';
import { API_BASE_URL } from '../services/api';

export type SeatConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export const useSeatSignalR = (
  eventId: string | undefined, 
  onSeatStatusChanged: (data: SeatStatusChangedPayload & { seatId: string; status: SeatStatus }) => void,
  onReconnected?: () => void
) => {
  const [status, setStatus] = useState<SeatConnectionStatus>('idle');
  const [retryKey, setRetryKey] = useState(0);

  const onSeatStatusChangedRef = useRef(onSeatStatusChanged);
  onSeatStatusChangedRef.current = onSeatStatusChanged;

  const onReconnectedRef = useRef(onReconnected);
  onReconnectedRef.current = onReconnected;

  const retry = useCallback(() => setRetryKey(value => value + 1), []);

  useEffect(() => {
    if (!eventId) {
      setStatus('idle');
      return;
    }

    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let connection: signalR.HubConnection | null = null;

    const startWithRetry = async (attempt = 1) => {
      if (!active) return;
      setStatus('connecting');

      try {
        if (!connection) {
          connection = new signalR.HubConnectionBuilder()
            .withUrl(`${API_BASE_URL}/hubs/seat`, {
              withCredentials: true,
            })
            .withAutomaticReconnect([0, 2000, 5000, 10000])
            .build();

          const handleSeatStatusChanged = (payload: SeatStatusChangedPayload) => {
            const seatId = payload.seatId || payload.SeatId || payload.id;
            let status: SeatStatus = 0;
            const rawStatus = (payload.status ?? payload.Status ?? '').toString().toLowerCase();
            
            if (rawStatus === 'locked' || rawStatus === '1') {
              status = 1;
            } else if (rawStatus === 'sold' || rawStatus === '2') {
              status = 2;
            } else {
              status = 0;
            }

            const reservationOwnerId = payload.reservationOwnerId ?? (payload as Record<string, unknown>).ReservationOwnerId as string | undefined;

            if (seatId) {
              onSeatStatusChangedRef.current({
                ...payload,
                seatId,
                status,
                reservationOwnerId,
                isLockedByCurrentUser: payload.isLockedByCurrentUser ?? payload.isLockedByMe,
              });
            }
          };

          const handleOwnSeatLockChanged = (payload: SeatStatusChangedPayload) => {
            const seatId = payload.seatId || payload.SeatId || payload.id;
            if (seatId) {
              onSeatStatusChangedRef.current({
                ...payload,
                seatId,
                status: 1,
                isLockedByCurrentUser: true,
              });
            }
          };

          connection.onreconnecting(() => active && setStatus('reconnecting'));
          connection.onreconnected(async () => {
            if (!active || !connection) return;
            setStatus('connected');
            try {
              await connection.invoke('JoinEventGroup', eventId);
            } catch (err) {
              if (import.meta.env.DEV) console.error('Failed to rejoin event group after SignalR reconnect', err);
            }
            onReconnectedRef.current?.();
          });
          connection.onclose(() => active && setStatus('disconnected'));
          connection.on('SeatStatusChanged', handleSeatStatusChanged);
          connection.on('OwnSeatLockChanged', handleOwnSeatLockChanged);
        }

        if (connection.state === signalR.HubConnectionState.Disconnected) {
          await connection.start();
        }

        if (!active || !connection) return;
        await connection.invoke('JoinEventGroup', eventId);
        if (active) setStatus('connected');
      } catch (err) {
        if (!active) return;
        if (import.meta.env.DEV) console.warn(`SignalR connection attempt ${attempt} failed`, err);

        // Auto-retry up to 4 attempts on initial failure (1s, 2s, 4s, 8s)
        if (attempt < 4) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          retryTimer = setTimeout(() => {
            void startWithRetry(attempt + 1);
          }, delay);
        } else {
          setStatus('disconnected');
        }
      }
    };

    void startWithRetry();

    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (!connection) return;
      void (async () => {
        try {
          if (connection?.state === signalR.HubConnectionState.Connected) {
            await connection.invoke('LeaveEventGroup', eventId).catch(() => undefined);
          }
        } finally {
          await connection?.stop().catch(() => undefined);
          connection = null;
        }
      })();
    };
  }, [eventId, retryKey]);

  return { status, retry };
};
