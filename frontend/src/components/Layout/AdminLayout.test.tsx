import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import AdminLayout from './AdminLayout';

describe('AdminLayout accessibility', () => {
  it('provides a keyboard skip link to the main content landmark', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<h1>Admin dashboard</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const skipLink = screen.getByRole('link', { name: 'Bỏ qua đến nội dung chính' });
    const main = screen.getByRole('main');
    expect(skipLink).toHaveAttribute('href', '#admin-main-content');
    expect(main).toHaveAttribute('id', 'admin-main-content');
    expect(main).toHaveAttribute('tabindex', '-1');
  });
});
