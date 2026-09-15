import { RefObject, useEffect, useRef } from 'react';

const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const dialogStack: HTMLElement[] = [];
let scrollLockCount = 0;
let previousBodyOverflow = '';

export function useModalAccessibility(
  isOpen: boolean,
  isBusy: boolean,
  onClose: () => void,
  containerRef: RefObject<HTMLElement | null>,
) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const isBusyRef = useRef(isBusy);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { isBusyRef.current = isBusy; }, [isBusy]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const container = containerRef.current;
    if (container) dialogStack.push(container);
    if (scrollLockCount++ === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    requestAnimationFrame(() => container?.querySelector<HTMLElement>(focusableSelector)?.focus());

    return () => {
      if (container) {
        const index = dialogStack.lastIndexOf(container);
        if (index >= 0) dialogStack.splice(index, 1);
      }
      if (--scrollLockCount === 0) document.body.style.overflow = previousBodyOverflow;
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    };
  }, [containerRef, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container || dialogStack[dialogStack.length - 1] !== container) return;
      if (event.key === 'Escape' && !isBusyRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const items = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, isOpen]);
}
