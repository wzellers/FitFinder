import React from 'react';
import { getColorName, getColorStyle } from '@/lib/colorUtils';

/** The CSS colour for a palette colour name. */
export function colorValue(color: string): string {
  return getColorStyle(color).backgroundColor;
}

/**
 * Two solid colour blocks side by side — the outfit's colour pairing — with a
 * readable label and a decorative script, after the "these colours are
 * married" moodboard. A single block when both colours match ("tonal").
 */
export default function ColorPairing({ a, b }: { a: string; b: string }) {
  const tonal = a === b;
  const label = tonal ? `${getColorName(a)} · tonal` : `${getColorName(a)} × ${getColorName(b)}`;
  return (
    <div className="relative h-24 sm:h-28 rounded-2xl overflow-hidden flex border border-black/5">
      <div
        className="flex-1 transition-colors duration-500"
        style={{ backgroundColor: colorValue(a) }}
      />
      {!tonal && (
        <div
          className="flex-1 transition-colors duration-500"
          style={{ backgroundColor: colorValue(b) }}
        />
      )}
      <span
        aria-hidden="true"
        className="font-script absolute right-4 top-2 text-3xl sm:text-4xl text-white -rotate-6 [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]"
      >
        {tonal ? 'all one' : 'are married'}
      </span>
      <span className="absolute left-3 bottom-3 rounded-full bg-white/90 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--burgundy)]">
        <span className="sr-only">Color pairing: </span>
        {label}
      </span>
    </div>
  );
}

/** A soft wash of two colours for a panel background, readable under text. */
export function pairingWash(a: string, b: string): React.CSSProperties {
  return {
    backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${colorValue(a)} 16%, white) 0%, white 45%, white 55%, color-mix(in srgb, ${colorValue(b)} 16%, white) 100%)`,
  };
}
