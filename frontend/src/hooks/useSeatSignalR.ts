import { useEffect, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { SeatStatus, SeatStatusChangedPayload } from '../types';
import { API_BASE_URL } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';

export const useSeatSignalR = (
  eventId: string | undefined, 
  onSeatStatusChanged: (data: SeatStatusChangedPayload & { seatId: string; status: SeatStatus }) => void
) => {
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);

  useEffect(() => {
    if (!eventId) return;

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_BASE_URL}/hubs/seat`, {
        withCredentials: true,
        accessTokenFactory: () => useAuthStore.getState().token ?? '',
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .build();

    setConnection(newConnection);
  }, [eventId]);

  useEffect(() => {
    if (connection && eventId) {
      connection.start()
        .then(() => {
          connection.invoke('JoinEventGroup', eventId);

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
          connection.on('SeatStatusChanged', handleSeatStatusChanged);
        })
        .catch(e => console.warn('SignalR Connection failed: ', e));

      return () => {
        if (connection.state === signalR.HubConnectionState.Connected) {
          connection.off('SeatStatusChanged');
          connection.invoke('LeaveEventGroup', eventId).finally(() => {
            connection.stop();
          });
        } else {
          connection.stop();
        }
      };
    }
  }, [connection, eventId, onSeatStatusChanged]);

  return connection;
};
