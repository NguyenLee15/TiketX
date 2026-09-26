import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

afterEach(() => vi.restoreAllMocks());

describe('ErrorBoundary', () => {
  it('shows a safe fallback instead of exposing the runtime error message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const BrokenView = () => {
      throw new Error('internal endpoint token=secret-value');
    };

    render(
      <ErrorBoundary>
        <BrokenView />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/Giao diện gặp sự cố ngoài dự kiến/)).toBeInTheDocument();
    expect(screen.queryByText(/secret-value/)).not.toBeInTheDocument();
  });
});
