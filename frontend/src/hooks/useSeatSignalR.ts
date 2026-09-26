import { useCallback, useEffect, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { SeatStatus, SeatStatusChangedPayload } from '../types';
import { API_BASE_URL } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';

export type SeatConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export const useSeatSignalR = (
  eventId: string | undefined, 
  onSeatStatusChanged: (data: SeatStatusChangedPayload & { seatId: string; status: SeatStatus }) => void,
  onReconnected?: () => void
) => {
  const [status, setStatus] = useState<SeatConnectionStatus>('idle');
  const [retryKey, setRetryKey] = useState(0);

  const retry = useCallback(() => setRetryKey(value => value + 1), []);

  useEffect(() => {
    if (!eventId) {
      setStatus('idle');
      return;
    }

    let active = true;
    let connection: signalR.HubConnection | null = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/seat`, {
        withCredentials: true,
        accessTokenFactory: () => useAuthStore.getState().token ?? '',
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

      if (seatId) {
        onSeatStatusChanged({
          ...payload,
          seatId,
          status,
          isLockedByCurrentUser: payload.isLockedByCurrentUser ?? payload.isLockedByMe,
        });
      }
    };

    const handleOwnSeatLockChanged = (payload: SeatStatusChangedPayload) => {
      const seatId = payload.seatId || payload.SeatId || payload.id;
      if (seatId) {
        onSeatStatusChanged({
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
        console.error('Failed to rejoin event group after SignalR reconnect', err);
      }
      onReconnected?.();
    });
    connection.onclose(() => active && setStatus('disconnected'));
    connection.on('SeatStatusChanged', handleSeatStatusChanged);
    connection.on('OwnSeatLockChanged', handleOwnSeatLockChanged);
    setStatus('connecting');

    void connection.start()
      .then(async () => {
        if (!active || !connection) return;
        await connection.invoke('JoinEventGroup', eventId);
        if (active) setStatus('connected');
      })
      .catch(() => active && setStatus('disconnected'));

    return () => {
      active = false;
      if (!connection) return;
      connection.off('SeatStatusChanged', handleSeatStatusChanged);
      connection.off('OwnSeatLockChanged', handleOwnSeatLockChanged);
      void (async () => {
        try {
          if (connection?.state === signalR.HubConnectionState.Connected) {
            await connection.invoke('LeaveEventGroup', eventId);
          }
        } finally {
          await connection?.stop();
          connection = null;
        }
      })();
    };
  }, [eventId, onSeatStatusChanged, onReconnected, retryKey]);

  return { status, retry };
};
