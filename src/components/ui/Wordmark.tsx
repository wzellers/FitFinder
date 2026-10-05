import React from 'react';

/** The FitFinder name. */
export default function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return <span className={`logo ${size === 'lg' ? 'text-4xl' : 'text-xl'}`}>FitFinder</span>;
}
