import React from 'react';
import { Check } from 'lucide-react';
import { colorPalette } from '@/lib/constants';
import { getColorName, getColorStyle, getContrastTextColor } from '@/lib/colorUtils';

interface ColorSwatchGroupProps {
  legend: React.ReactNode;
  value: string | null;
  onChange: (color: string | null) => void;
  /** Offer a "None" choice (for optional colours). */
  allowNone?: boolean;
  /** A colour that can't be picked here (e.g. the main colour, for the second one). */
  disabledColor?: string | null;
  size?: 'sm' | 'md';
}

/** A labelled set of colour swatches; each swatch is a named toggle button. */
export default function ColorSwatchGroup({
  legend,
  value,
  onChange,
  allowNone = false,
  disabledColor = null,
  size = 'md',
}: ColorSwatchGroupProps) {
  const box = size === 'sm' ? 'w-9 h-9' : 'w-11 h-11';
  return (
    <fieldset>
      <legend className="text-sm font-semibold mb-2">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {allowNone && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-pressed={value === null}
            className={`${box} rounded-md border-2 border-dashed text-xs font-semibold ${
              value === null
                ? 'border-[var(--text)] text-[var(--text)]'
                : 'border-[var(--line-strong)] text-[var(--text-secondary)]'
            }`}
          >
            None
          </button>
        )}
        {colorPalette.map((color) => {
          const selected = value === color;
          const disabled = disabledColor === color;
          return (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              disabled={disabled}
              aria-pressed={selected}
              aria-label={getColorName(color)}
              title={getColorName(color)}
              className={`${box} rounded-md border flex items-center justify-center transition-transform disabled:opacity-25 disabled:cursor-not-allowed ${
                selected
                  ? 'border-[var(--text)] ring-2 ring-offset-2 ring-[var(--text)] scale-105'
                  : 'border-black/20 hover:scale-105'
              }`}
              style={getColorStyle(color)}
            >
              {selected && (
                <Check
                  size={16}
                  aria-hidden="true"
                  style={{ color: getContrastTextColor(color) }}
                />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-[var(--text-secondary)] mt-1.5" aria-live="polite">
        {value ? getColorName(value) : allowNone ? 'None' : 'Not chosen yet'}
      </p>
    </fieldset>
  );
}
