import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

const Broken = () => {
  throw new Error('secret internal stack detail');
};

describe('ErrorBoundary', () => {
  it('does not render the raw exception message in production', () => {
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );

    expect(screen.queryByText('secret internal stack detail')).not.toBeInTheDocument();
    expect(screen.getByText(/Giao diện gặp sự cố/i)).toBeInTheDocument();
  });
});
