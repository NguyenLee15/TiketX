import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EventModal from './EventModal';

describe('EventModal validation accessibility', () => {
  it('connects location and start-time validation errors to their fields', async () => {
    const { container } = render(
      <EventModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} />
    );

    fireEvent.click(container.querySelector<HTMLButtonElement>('button[type="submit"]')!);

    await vi.waitFor(() => {
      for (const fieldId of ['event-location', 'event-date']) {
        const field = container.querySelector<HTMLElement>(`#${fieldId}`);
        expect(field).toHaveAttribute('aria-invalid', 'true');
        const errorId = field?.getAttribute('aria-describedby');
        expect(errorId).toBeTruthy();
        expect(container.querySelector(`#${errorId}`)).toHaveAttribute('role', 'alert');
      }
    });
  });
});
