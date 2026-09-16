import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScanResultDisplay, ScanResult } from './ScanResultDisplay';

describe('ScanResultDisplay', () => {
  it('renders ready state when no scan result provided', () => {
    render(<ScanResultDisplay scanResult={null} />);
    expect(screen.getByText('Sẵn sàng soát vé')).toBeInTheDocument();
  });

  it('renders valid ticket details with success message and attendee info', () => {
    const validResult: ScanResult = {
      status: 'valid',
      message: 'VÉ HỢP LỆ — XÁC NHẬN CHO VÀO CỬA SỰ KIỆN',
      ticket: {
        ticketId: 't-123',
        eventTitle: 'Concert Hanoi 2026',
        attendeeName: 'Nguyen Van A',
        row: 'A',
        number: 12,
        tier: 'VIP',
        orderCode: 998877,
        checkedInAt: '2026-09-16T10:00:00Z'
      }
    };

    render(<ScanResultDisplay scanResult={validResult} />);
    expect(screen.getByText('VÉ HỢP LỆ — XÁC NHẬN CHO VÀO CỬA SỰ KIỆN')).toBeInTheDocument();
    expect(screen.getByText('Nguyen Van A')).toBeInTheDocument();
    expect(screen.getByText('Concert Hanoi 2026')).toBeInTheDocument();
    expect(screen.getByText('Hàng A - Ghế 12')).toBeInTheDocument();
    expect(screen.getByText('#998877')).toBeInTheDocument();
  });

  it('renders conflict badge when check-in has concurrency conflict', () => {
    const conflictResult: ScanResult = {
      status: 'conflict',
      message: 'CẢNH BÁO XUNG ĐỘT: Vé vừa được xử lý bởi trạm soát vé khác!'
    };

    render(<ScanResultDisplay scanResult={conflictResult} />);
    expect(screen.getByText('Xung Đột Trạm Soát Vé (HTTP 409)')).toBeInTheDocument();
    expect(screen.getByText('CẢNH BÁO XUNG ĐỘT: Vé vừa được xử lý bởi trạm soát vé khác!')).toBeInTheDocument();
  });

  it('renders already used status message', () => {
    const usedResult: ScanResult = {
      status: 'already_used',
      message: 'Vé này đã được check-in trước đó lúc 19:30:00.'
    };

    render(<ScanResultDisplay scanResult={usedResult} />);
    expect(screen.getByText('Vé này đã được check-in trước đó lúc 19:30:00.')).toBeInTheDocument();
  });
});
