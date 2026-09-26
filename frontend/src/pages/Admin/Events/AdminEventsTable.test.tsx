import { render, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminEventsTable } from './AdminEventsTable';
import type { Event } from '../../../types';

vi.mock('../../../utils/formatters', () => ({
  formatCurrency: () => '',
  formatDate: () => ''
}));

const event: Event = {
  id: 'event-1',
  title: 'Concert',
  description: 'Live music',
  date: '2026-10-01T18:00:00Z',
  endDate: '2026-10-01T21:00:00Z',
  location: 'Hanoi',
  venueName: 'Arena',
  category: 'Music',
  imageUrl: '/concert.jpg',
  totalSeats: 100,
  basePrice: 100000,
  status: 'Draft',
  isDeleted: true
};

describe('AdminEventsTable', () => {
  it('disables all mutation actions for a deleted event', () => {
    const { container } = render(
      <AdminEventsTable
        events={[event]}
        totalCount={1}
        page={1}
        totalPages={1}
        onPageChange={vi.fn()}
        onEdit={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const mobileList = Array.from(container.querySelectorAll('div')).find(element => element.classList.contains('md:hidden'));
    expect(mobileList).toBeDefined();
    const buttons = within(mobileList as HTMLElement).getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons.every(button => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it('gives desktop icon actions explicit accessible names', () => {
    const { container } = render(
      <AdminEventsTable
        events={[{ ...event, isDeleted: false }]}
        totalCount={1}
        page={1}
        totalPages={1}
        onPageChange={vi.fn()}
        onEdit={vi.fn()}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const desktopTable = Array.from(container.querySelectorAll('div')).find(element => element.classList.contains('md:block'));
    expect(desktopTable).toBeDefined();
    const buttons = within(desktopTable as HTMLElement).getAllByRole('button');
    expect(buttons.map(button => button.getAttribute('aria-label'))).toEqual([
      'Sửa sự kiện Concert',
      'Hủy sự kiện Concert và hoàn tiền vé',
      'Xóa sự kiện Concert'
    ]);
  });
});
