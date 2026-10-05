'use client';

import React, { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open modals in mount order. Used to restore body scrolling once the last
// one closes, and to pick which one handles keys.
const openStack: number[] = [];
let nextId = 0;

interface ModalProps {
  /** Accessible name announced when the dialog opens. */
  label: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra classes for the dialog panel (e.g. a max width). */
  className?: string;
  /** When false, Escape and backdrop clicks don't close it. */
  dismissible?: boolean;
}

/**
 * Accessible modal dialog: role="dialog", focus moves in on open and back to
 * the trigger on close, Tab stays inside, Escape and backdrop click close it.
 * Render it conditionally; it is open while mounted.
 */
export default function Modal({
  label,
  onClose,
  children,
  className = '',
  dismissible = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  onCloseRef.current = onClose;
  dismissibleRef.current = dismissible;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const id = ++nextId;
    openStack.push(id);
    const returnFocusTo = document.activeElement as HTMLElement | null;

    // Respect an autoFocus'd field; otherwise focus the dialog itself so
    // screen readers announce its name.
    if (!panel.contains(document.activeElement)) panel.focus();

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );

    const onKeyDown = (e: KeyboardEvent) => {
      // Defer to a dialog opened inside this one, or to one opened after it.
      if (panel.querySelector('[role="dialog"]')) return;
      const topmost = openStack[openStack.length - 1] === id;
      if (!topmost && !panel.contains(document.activeElement)) return;
      if (e.key === 'Escape' && dismissibleRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openStack.splice(openStack.indexOf(id), 1);
      if (openStack.length === 0) document.body.style.overflow = previousOverflow;
      returnFocusTo?.focus?.();
    };
  }, []);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`modal-content focus:outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
