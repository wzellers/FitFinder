'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useOutfitTheme } from '@/components/OutfitTheme';
import { getColorName, getColorStyle } from '@/lib/colorUtils';

interface PosterHeaderProps {
  /** Page title, set huge and condensed. */
  title: string;
  /** A short script word layered over the title (decorative). */
  script?: string;
  /** Monospace readout under the title, e.g. "{ 28 items · 0 in the wash }". */
  readout?: React.ReactNode;
  /** Buttons shown beside the readout. */
  actions?: React.ReactNode;
}

/**
 * A poster-style page header: a colour block with huge condensed type, a
 * retro script word over it, and a cutout shape bleeding off the corner.
 * Burgundy / sky blue by default; after an outfit is generated it takes on
 * that outfit's colours (see OutfitThemeProvider).
 */
export default function PosterHeader({ title, script, readout, actions }: PosterHeaderProps) {
  const { pairing, setPairing } = useOutfitTheme();
  return (
    <header className="poster relative overflow-hidden rounded-[28px] bg-[var(--poster-bg)] px-6 sm:px-10 pt-8 sm:pt-10 pb-6 mb-8 transition-colors duration-700">
      <Cutout className="absolute -right-12 -top-20 w-28 sm:-right-14 sm:-top-28 sm:w-72 text-[var(--poster-cutout)] transition-colors duration-700" />
      {pairing && (
        <div className="relative sm:absolute sm:right-6 sm:bottom-auto sm:top-5 mb-4 sm:mb-0 flex justify-start sm:justify-end">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/90 pl-2 pr-1 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#2a0c12] shadow-sm">
            <span className="flex -space-x-1" aria-hidden="true">
              {pairing.map((c, i) => (
                <span
                  key={i}
                  className="w-3.5 h-3.5 rounded-full border border-white"
                  style={getColorStyle(c)}
                />
              ))}
            </span>
            Styled by today&apos;s fit
            <span className="sr-only">
              : {getColorName(pairing[0])} and {getColorName(pairing[1])}
            </span>
            <button
              onClick={() => setPairing(null)}
              aria-label="Reset colors"
              className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/5"
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        </div>
      )}
      <div className="relative">
        <h2 className="font-poster uppercase leading-[0.82] text-[var(--poster-title)] text-[clamp(3.25rem,11vw,8.5rem)] tracking-[-0.01em] transition-colors duration-700">
          {title}
        </h2>
        {script && (
          <span
            aria-hidden="true"
            className="font-script block w-fit -mt-4 sm:-mt-7 mb-3 ml-[18%] -rotate-6 text-[var(--poster-fg)] text-[clamp(2rem,5vw,3.75rem)] leading-none transition-colors duration-700"
          >
            {script}
          </span>
        )}
      </div>
      {(readout || actions) && (
        <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3">
          {readout ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--poster-fg)] transition-colors duration-700">
              {readout}
            </p>
          ) : (
            <span />
          )}
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
    </header>
  );
}

/** An organic cutout shape, like a paper collage piece. */
function Cutout({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={className} fill="currentColor">
      <path d="M152 18c26 14 40 47 30 74-7 19-29 24-33 44-5 24 22 43 8 57-15 15-44-2-64-9-25-9-58-1-73-24-14-22 6-48 23-63 16-14 15-37 30-53 20-22 52-41 79-26Z" />
    </svg>
  );
}
