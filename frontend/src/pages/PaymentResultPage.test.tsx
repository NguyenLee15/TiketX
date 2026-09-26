import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import PaymentResultPage from './PaymentResultPage';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('PaymentResultPage compensation', () => {
  it('shows a destination action when a cancelled ticket has an orphan refund', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { orderCode: '123', status: 'Cancelled', refundStatus: 'AwaitingDestination' } } });
    render(<MemoryRouter initialEntries={['/payment-result?orderCode=123']}><PaymentResultPage /></MemoryRouter>);

    expect(await screen.findByText('Cần tài khoản nhận tiền')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Thiết lập tài khoản nhận tiền' })).toHaveAttribute('href', '/profile?refundBankAccount=1');
  });

  it.each([
    ['Pending', 'Khoản bồi hoàn đang chờ xử lý.'],
    ['Processing', /Khoản bồi hoàn đang được xử lý/],
    ['NeedsReview', 'Khoản bồi hoàn cần đối soát. Vui lòng liên hệ hỗ trợ.'],
    ['Completed', 'Khoản bồi hoàn đã được xác nhận.'],
    ['Failed', 'Yêu cầu bồi hoàn chưa hoàn tất. Vui lòng liên hệ hỗ trợ.'],
  ])('shows the refund status %s returned by the API', async (refundStatus, message) => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { orderCode: '123', status: 'RefundPending', refundStatus } } });
    render(<MemoryRouter initialEntries={['/payment-result?orderCode=123']}><PaymentResultPage /></MemoryRouter>);

    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});
