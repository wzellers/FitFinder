import React from 'react';

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
 * A poster-style page header: a burgundy block with huge condensed sky-blue
 * type, a retro script word over it, and a sky cutout shape bleeding off the
 * edge (after the burgundy / sky blue moodboard).
 */
export default function PosterHeader({ title, script, readout, actions }: PosterHeaderProps) {
  return (
    <header className="poster relative overflow-hidden rounded-[28px] bg-[var(--burgundy)] px-6 sm:px-10 pt-8 sm:pt-10 pb-6 mb-8">
      <Cutout className="absolute -right-14 -top-24 w-40 sm:-top-28 sm:w-72 text-[var(--sky)]" />
      <div className="relative">
        <h2 className="font-poster uppercase leading-[0.82] text-[var(--sky)] text-[clamp(3.25rem,11vw,8.5rem)] tracking-[-0.01em]">
          {title}
        </h2>
        {script && (
          <span
            aria-hidden="true"
            className="font-script block -mt-4 sm:-mt-7 ml-[18%] -rotate-6 text-[var(--sky-wash)] text-[clamp(2rem,5vw,3.75rem)] leading-none"
          >
            {script}
          </span>
        )}
      </div>
      {(readout || actions) && (
        <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3">
          {readout ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--sky-wash)]">
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
