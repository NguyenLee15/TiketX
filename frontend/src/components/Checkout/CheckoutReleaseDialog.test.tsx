import { useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useModalAccessibility } from '../Admin/useModalAccessibility';
import { CheckoutReleaseDialog } from './CheckoutReleaseDialog';

afterEach(cleanup);

function NestedCheckout({ releasing = false }: { releasing?: boolean }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const checkoutRef = useRef<HTMLDivElement>(null);
  useModalAccessibility(true, false, vi.fn(), checkoutRef);

  return (
    <div ref={checkoutRef} role="dialog" aria-label="Checkout">
      <button type="button" onClick={() => setConfirmOpen(true)}>Trả ghế</button>
      <button type="button">Thao tác bên ngoài</button>
      <CheckoutReleaseDialog
        isOpen={confirmOpen}
        releasing={releasing}
        releaseError=""
        onCancel={() => setConfirmOpen(false)}
        onConfirm={vi.fn()}
      />
    </div>
  );
}

describe('CheckoutReleaseDialog accessibility', () => {
  it('traps focus, handles Escape in the topmost dialog, and restores focus', async () => {
    const user = userEvent.setup();
    render(<NestedCheckout />);
    const opener = screen.getByRole('button', { name: 'Trả ghế' });
    opener.focus();
    fireEvent.click(opener);

    const cancel = await screen.findByRole('button', { name: 'Tiếp tục thanh toán' });
    await waitFor(() => expect(cancel).toHaveFocus());
    await user.tab();
    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Trả ghế & đóng' })).toHaveFocus();
    await user.tab();
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it('keeps the release confirmation open while the release request is running', async () => {
    render(<NestedCheckout releasing />);
    fireEvent.click(screen.getByRole('button', { name: 'Trả ghế' }));
    await screen.findByRole('alertdialog');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    const dialog = within(screen.getByRole('alertdialog'));
    expect(dialog.getByRole('button', { name: 'Tiếp tục thanh toán' })).toBeDisabled();
    expect(dialog.getByRole('button', { name: 'Đang trả ghế…' })).toBeDisabled();
  });
});
