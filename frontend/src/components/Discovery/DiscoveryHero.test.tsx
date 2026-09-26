import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DiscoveryHero } from './DiscoveryHero';

describe('DiscoveryHero', () => {
  it('exposes labeled catalog controls and announces the active category', () => {
    render(
      <DiscoveryHero
        search=""
        sortBy="date_asc"
        selectedCategory="All"
        onSearchChange={() => undefined}
        onSortChange={() => undefined}
        onCategoryChange={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByLabelText('Tìm kiếm sự kiện')).toBeInTheDocument();
    expect(screen.getByLabelText('Sắp xếp sự kiện')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Lọc theo danh mục' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tất cả sự kiện' })).toHaveAttribute('aria-pressed', 'true');
  });
});
