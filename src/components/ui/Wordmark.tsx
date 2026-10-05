import React from 'react';

/** Coat-hanger mark used beside the FitFinder name. */
export function HangerMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 8.5V7a2.6 2.6 0 1 0-2.6-2.6" />
      <path d="M16 8.5 3 18.2c-.9.7-.4 2 .7 2h24.6c1.1 0 1.6-1.3.7-2L16 8.5Z" />
    </svg>
  );
}

/** The FitFinder name set as a printed shop sign. */
export default function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <span className="inline-flex items-center gap-2 text-[var(--text)]">
      <HangerMark className={`${lg ? 'w-12 h-9' : 'w-7 h-5'} text-[var(--carbon)]`} />
      <span className={`logo ${lg ? 'text-5xl' : 'text-2xl'}`}>FitFinder</span>
    </span>
  );
}
