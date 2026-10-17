'use client';
import { useEffect, useRef, type RefObject } from 'react';

export function useModalFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, containFocus = true) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const background = new Map<HTMLElement, boolean>();
    if (containFocus) {
      // Inert only siblings of the modal's ancestor chain, never the modal itself.
      let branch: HTMLElement = dialog;
      while (branch.parentElement) {
        for (const sibling of Array.from(branch.parentElement.children)) {
          if (sibling instanceof HTMLElement && sibling !== branch) {
            background.set(sibling, sibling.inert);
            sibling.inert = true;
          }
        }
        branch = branch.parentElement;
        if (branch === document.body) break;
      }
    }
    dialog.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (!containFocus || event.key !== 'Tab') return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]'))
        .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
      const first = controls[0];
      const last = controls[controls.length - 1];
      const current = document.activeElement;
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (current === first || current === dialog || !dialog.contains(current))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (current === last || current === dialog || !dialog.contains(current))) {
        event.preventDefault(); first.focus();
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (containFocus && event.target instanceof Node && !dialog.contains(event.target)) dialog.focus();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocus);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocus);
      background.forEach((inert, element) => { element.inert = inert; });
      if (previous?.isConnected) previous.focus();
    };
  }, [ref, open, containFocus]);
}
