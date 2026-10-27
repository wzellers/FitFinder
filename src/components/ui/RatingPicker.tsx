'use client';

import React, { useState } from 'react';

interface RatingPickerProps {
  /** Current rating, 1–10, or 0 for none. */
  value: number;
  onChange: (value: number) => void;
  legend: React.ReactNode;
  /** Tapping the current value clears it (default true). */
  clearable?: boolean;
  disabled?: boolean;
  /** Called with the number being pointed at or focused (0 when none), so a
   * caller can preview the rating, e.g. warm the outfit's glow. */
  onPreview?: (value: number) => void;
}

/** A row of 1–10 buttons for rating an outfit. Pointing at a number fills
 * the row up to it, as a live preview. */
export default function RatingPicker({
  value,
  onChange,
  legend,
  clearable = true,
  disabled = false,
  onPreview,
}: RatingPickerProps) {
  const [hover, setHover] = useState(0);
  const preview = (n: number) => {
    setHover(n);
    onPreview?.(n);
  };
  const shown = hover || value;
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-semibold mb-2">{legend}</legend>
      <div className="flex flex-wrap gap-1.5" onMouseLeave={() => preview(0)}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(clearable && value === n ? 0 : n)}
            onMouseEnter={() => preview(n)}
            onFocus={() => preview(n)}
            onBlur={() => preview(0)}
            aria-pressed={value === n}
            aria-label={`${n} out of 10`}
            data-filled={n <= shown ? 'true' : undefined}
            className={`tabular w-10 h-10 rounded-md border text-sm font-semibold transition-[background-color,color,transform] duration-150 disabled:opacity-50 ${
              n === shown
                ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)] scale-105'
                : n <= shown
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
