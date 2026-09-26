import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import api from '../../services/api';
import AdminRefundsPage from './AdminRefundsPage';

vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

describe('AdminRefundsPage', () => {
  it('provides a compact, labeled refund list for narrow screens', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: {
      items: [{
        id: 'refund-12345678', eventId: 'event-1', ticketId: 'ticket-87654321', amount: 150000,
        status: 'NeedsReview', attempts: 2, providerStatus: 'PENDING', providerReference: null,
        lastError: null, createdAt: '2026-09-26T10:00:00Z', nextAttemptAt: null,
      }],
      page: 1, pageSize: 25, totalCount: 1,
    } } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminRefundsPage />
      </QueryClientProvider>,
    );

    const refundList = await screen.findByRole('list', { name: 'Yêu cầu hoàn tiền' });
    expect(refundList).toHaveTextContent('refund-1');
    expect(refundList).toHaveTextContent('NeedsReview');
    expect(refundList).toHaveTextContent('PENDING');
    expect(within(refundList).getByRole('button', { name: /Đối soát \/ thử lại/i })).toBeInTheDocument();
  });
});
