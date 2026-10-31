import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReservationCountdown } from './useReservationCountdown';

describe('useReservationCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with null when lockExpiresAt is null', () => {
    const { result } = renderHook(() =>
      useReservationCountdown({ lockExpiresAt: null })
    );

    expect(result.current.timeLeft).toBeNull();
    expect(result.current.formattedTime).toBeNull();
  });

  it('calculates initial remaining seconds and formatted string', () => {
    const expiresAt = new Date(Date.now() + 125 * 1000).toISOString(); // 2m 5s
    const { result } = renderHook(() =>
      useReservationCountdown({ lockExpiresAt: expiresAt })
    );

    expect(result.current.timeLeft).toBe(125);
    expect(result.current.formattedTime).toBe('02:05');
  });

  it('compensates for client clock skew when serverTime is provided', () => {
    // Client clock is 60s behind server
    const clientNow = Date.now();
    const serverNow = new Date(clientNow + 60 * 1000).toISOString();
    // lock expires 120s after serverNow (so 180s after clientNow)
    const lockExpiresAt = new Date(clientNow + 180 * 1000).toISOString();

    const { result } = renderHook(() =>
      useReservationCountdown({
        lockExpiresAt,
        serverTime: serverNow,
      })
    );

    // Correctly computes 120s remaining instead of unadjusted 180s
    expect(result.current.timeLeft).toBe(120);
    expect(result.current.formattedTime).toBe('02:00');
  });

  it('triggers onExpire callback and resets timeLeft when timer reaches 0', () => {
    const onExpire = vi.fn();
    const expiresAt = new Date(Date.now() + 3 * 1000).toISOString(); // 3s
    const { result } = renderHook(() =>
      useReservationCountdown({ lockExpiresAt: expiresAt, onExpire })
    );

    expect(result.current.timeLeft).toBe(3);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.timeLeft).toBeNull();
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
