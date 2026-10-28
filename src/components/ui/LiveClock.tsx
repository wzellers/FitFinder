'use client';

import React, { useEffect, useState } from 'react';

const CLOCK_KEY = 'fitfinder:clock-24h';

function read24h(): boolean {
  try {
    return localStorage.getItem(CLOCK_KEY) === 'on';
  } catch {
    return false;
  }
}

/** Local time as a monospace readout, updated every second. 12-hour by
 * default; clicking it switches to 24-hour (and back), remembered. */
export default function LiveClock({ className = '' }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  const [use24h, setUse24h] = useState(false);

  useEffect(() => {
    setUse24h(read24h());
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;
  const toggle = () => {
    const next = !use24h;
    setUse24h(next);
    try {
      localStorage.setItem(CLOCK_KEY, next ? 'on' : 'off');
    } catch {
      // Not remembered (private mode); still switches now.
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      title={use24h ? 'Show 12-hour time' : 'Show 24-hour time'}
      aria-label={`Local time ${now.toLocaleTimeString('en-US', { hour12: !use24h })}. Switch to ${use24h ? '12' : '24'}-hour time`}
      className={`readout rounded-full px-2 py-1 hover:bg-[var(--muted)] transition-colors ${className}`}
    >
      local{' '}
      <time dateTime={now.toISOString()} className="text-[var(--text)] font-semibold tabular">
        {now.toLocaleTimeString('en-US', { hour12: !use24h })}
      </time>
    </button>
  );
}
