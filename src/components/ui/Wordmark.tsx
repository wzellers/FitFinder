import React from 'react';

/** The FitFinder name. */
export default function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return <span className={`logo ${size === 'lg' ? 'text-6xl' : 'text-2xl'}`}>FitFinder</span>;
}
