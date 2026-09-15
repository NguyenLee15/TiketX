import { useRef, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useModalAccessibility } from './useModalAccessibility';

function NestedDialogs({ onOuterClose, onInnerClose }: { onOuterClose: () => void; onInnerClose: () => void }) {
  const [innerOpen, setInnerOpen] = useState(false);
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  useModalAccessibility(true, false, onOuterClose, outerRef);
  useModalAccessibility(innerOpen, false, () => { setInnerOpen(false); onInnerClose(); }, innerRef);

  return (
    <div ref={outerRef} role="dialog">
      <button type="button" onClick={() => setInnerOpen(true)}>Mở xác nhận</button>
      <button type="button">Thao tác ngoài</button>
      {innerOpen && <div ref={innerRef} role="alertdialog"><button type="button">Xác nhận</button></div>}
    </div>
  );
}

describe('useModalAccessibility', () => {
  it('routes Escape only to the topmost nested dialog', async () => {
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    render(<NestedDialogs onOuterClose={onOuterClose} onInnerClose={onInnerClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mở xác nhận' }));
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onInnerClose).toHaveBeenCalledTimes(1);
    expect(onOuterClose).not.toHaveBeenCalled();
  });
});
