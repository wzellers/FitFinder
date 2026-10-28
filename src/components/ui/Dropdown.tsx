'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  /** A colour swatch shown before the label. */
  swatch?: string;
}

interface DropdownProps {
  /** What the dropdown chooses, e.g. "Category" (its accessible name). */
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  /** Required and still unset: outlined in red. */
  invalid?: boolean;
}

/**
 * A dropdown in the app's style: a pill button that opens a list of
 * options (a listbox). Works with the mouse, touch and keyboard: arrows move,
 * Enter or Space picks, Escape closes, and typing a letter jumps to an option.
 */
export default function Dropdown({
  label,
  value,
  options,
  onChange,
  className = '',
  disabled = false,
  invalid = false,
}: DropdownProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];
  const chosen = value !== (options[0]?.value ?? '');

  // Close when clicking or tapping outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  const openList = () => {
    setActive(selectedIndex);
    setOpen(true);
  };
  const pick = (i: number) => {
    onChange(options[i].value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(active);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key.length === 1) {
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`${label}: ${selected?.label ?? ''}${invalid ? ' (required)' : ''}`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openList();
          }
        }}
        className={`min-h-[40px] pl-4 pr-3 rounded-full border text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          invalid
            ? 'border-[var(--danger)] ring-1 ring-[var(--danger)] bg-white text-[var(--text)]'
            : chosen
              ? 'border-[var(--accent)] bg-[var(--accent-light)] text-[var(--text)]'
              : 'border-[var(--line-strong)] bg-white text-[var(--text)] hover:bg-[var(--muted)]'
        }`}
      >
        {selected?.swatch && (
          <span
            aria-hidden="true"
            className="w-3.5 h-3.5 rounded-full border border-black/15"
            style={{ backgroundColor: selected.swatch }}
          />
        )}
        {selected?.label}
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`text-[var(--text-secondary)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={onListKey}
          className="dropdown-menu absolute z-30 left-0 mt-2 min-w-full w-max max-h-72 overflow-auto rounded-2xl border border-[var(--border)] bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(43,33,28,0.35)] focus:outline-none"
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`flex items-center gap-2.5 min-h-[40px] pl-3 pr-8 rounded-xl text-sm cursor-pointer relative ${
                  i === active ? 'bg-[var(--muted)]' : ''
                } ${isSelected ? 'font-semibold text-[var(--accent)]' : 'text-[var(--text)]'}`}
              >
                {o.swatch && (
                  <span
                    aria-hidden="true"
                    className="w-4 h-4 rounded-full border border-black/15 shrink-0"
                    style={{ backgroundColor: o.swatch }}
                  />
                )}
                {o.label}
                {isSelected && (
                  <Check size={15} aria-hidden="true" className="absolute right-2.5" />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
