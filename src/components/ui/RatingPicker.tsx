'use client';

import React from 'react';

interface RatingPickerProps {
  /** Current rating, 1–10, or 0 for none. */
  value: number;
  onChange: (value: number) => void;
  legend: React.ReactNode;
  /** Tapping the current value clears it (default true). */
  clearable?: boolean;
  disabled?: boolean;
}

/** A row of 1–10 buttons for rating an outfit. */
export default function RatingPicker({
  value,
  onChange,
  legend,
  clearable = true,
  disabled = false,
}: RatingPickerProps) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-semibold mb-2">{legend}</legend>
      <div className="flex flex-wrap gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(clearable && value === n ? 0 : n)}
            aria-pressed={value === n}
            aria-label={`${n} out of 10`}
            className={`tabular w-10 h-10 rounded-md border text-sm font-semibold transition-colors disabled:opacity-50 ${
              value === n
                ? 'bg-[var(--sky)] text-[var(--burgundy)] border-[var(--sky)]'
                : n <= value
                  ? 'bg-[var(--accent-light)] border-[var(--line-strong)]'
                  : 'bg-white border-[var(--line-strong)] text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
