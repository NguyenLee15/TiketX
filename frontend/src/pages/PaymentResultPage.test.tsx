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

    expect(await screen.findByText('Giao dịch đang được bồi hoàn')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Thiết lập tài khoản nhận tiền' })).toHaveAttribute('href', '/profile?refundBankAccount=1');
  });
});
