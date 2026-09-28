import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdminDashboardEmptyState } from './AdminDashboardEmptyState';

describe('AdminDashboardEmptyState', () => {
  it('guides an admin to create an event and refresh data', () => {
    const onRefresh = vi.fn();
    render(
      <MemoryRouter>
        <AdminDashboardEmptyState onRefresh={onRefresh} isRefreshing={false} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Chưa có dữ liệu quản trị' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tạo sự kiện' })).toHaveAttribute('href', '/admin/events');
    screen.getByRole('button', { name: 'Làm mới' }).click();
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
