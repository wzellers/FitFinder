'use client';

import React, { useEffect, useState } from 'react';

/** Local time as a monospace readout, updated every second. */
export default function LiveClock({ className = '' }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;
  return (
    <span className={`readout ${className}`}>
      local{' '}
      <time dateTime={now.toISOString()} className="text-[var(--text)] font-semibold">
        {now.toLocaleTimeString('en-US', { hour12: false })}
      </time>
    </span>
  );
}
