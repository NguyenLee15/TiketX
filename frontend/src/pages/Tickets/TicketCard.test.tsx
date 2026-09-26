import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TicketCard, type TicketItemData } from './TicketCard';

afterEach(cleanup);

const ticket: TicketItemData = {
  id: 'ticket-1', eventId: 'event-1', seatId: 'seat-1', eventTitle: 'Concert',
  eventDescription: '', eventDate: '2026-10-01T12:00:00Z', endDate: '2026-10-01T14:00:00Z',
  location: 'HCM', category: 'Music', imageUrl: '', row: 'C', number: 1, tier: 0,
  price: 100000, status: 'Cancelled', orderCode: '123', qrCodeSignature: '',
  refundCutoffHours: 24, canRefund: false,
};

describe('TicketCard compensation', () => {
  it('guides a cancelled ticket owner to add a destination', () => {
    render(<MemoryRouter><TicketCard ticket={{ ...ticket, refundStatus: 'AwaitingDestination' }} refundingId={null} onInitiateRefund={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText(/Khoản bồi hoàn đang chờ tài khoản nhận tiền/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Thiết lập tài khoản nhận tiền' })).toHaveAttribute('href', '/profile?refundBankAccount=1');
  });
});
