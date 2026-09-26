import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TicketCard, type TicketItemData } from './TicketCard';

afterEach(cleanup);

const { generateTicketPdf } = vi.hoisted(() => ({ generateTicketPdf: vi.fn() }));
vi.mock('../../utils/ticketPdfGenerator', () => ({ generateTicketPdf }));

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

  it('does not show a refund destination action without AwaitingDestination status', () => {
    render(<MemoryRouter><TicketCard ticket={{ ...ticket, status: 'RefundPending' }} refundingId={null} onInitiateRefund={vi.fn()} /></MemoryRouter>);

    expect(screen.queryByRole('link', { name: /tài khoản nhận/i })).not.toBeInTheDocument();
    expect(screen.getByText('Khoản bồi hoàn đang được xử lý.')).toBeInTheDocument();
  });

  it.each([
    ['Pending', 'Khoản bồi hoàn đang chờ xử lý.'],
    ['Processing', 'Khoản bồi hoàn đang được xử lý.'],
    ['NeedsReview', 'Khoản bồi hoàn cần được đối soát.'],
    ['Completed', 'Khoản bồi hoàn đã hoàn tất.'],
    ['Failed', 'Yêu cầu bồi hoàn chưa hoàn tất. Vui lòng liên hệ hỗ trợ.'],
  ] as const)('shows customer guidance for refund status %s', (refundStatus, expectedMessage) => {
    render(<MemoryRouter><TicketCard ticket={{ ...ticket, refundStatus }} refundingId={null} onInitiateRefund={vi.fn()} /></MemoryRouter>);

    expect(screen.getByText(new RegExp(expectedMessage))).toBeInTheDocument();
  });

  it('announces PDF generation failures and allows the customer to retry', async () => {
    generateTicketPdf.mockRejectedValueOnce(new Error('renderer failed')).mockResolvedValueOnce(undefined);
    render(<MemoryRouter><TicketCard ticket={{ ...ticket, status: 'Paid', qrCodeSignature: 'signed-qr' }} refundingId={null} onInitiateRefund={vi.fn()} /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /tải file vé pdf/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tạo file vé PDF. Vui lòng thử lại.');
    await waitFor(() => expect(screen.getByRole('button', { name: /tải file vé pdf/i })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: /tải file vé pdf/i }));
    await waitFor(() => expect(generateTicketPdf).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
