'use client';

import React, { useEffect } from 'react';
import { Check } from 'lucide-react';
import ClothingImage from '@/components/ui/ClothingImage';
import type { ClothingItem } from '@/lib/types';

/** How long the stamp stays on screen. */
export const WORN_STAMP_MS = 1800;

interface WornStampProps {
  /** The outfit just logged: top, bottom, shoes. */
  pieces: ClothingItem[];
  /** The day it was logged for. */
  date: Date;
  onDone: () => void;
}

/**
 * A short flourish after "Wear today": the outfit's pieces shrink into a
 * small calendar tile for the day, then a check mark pops in. Decorative
 * (the toast says what happened), so hidden from screen readers.
 */
export default function WornStamp({ pieces, date, onDone }: WornStampProps) {
  useEffect(() => {
    const t = setTimeout(onDone, WORN_STAMP_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      aria-hidden="true"
      data-testid="worn-stamp"
      className="worn-stamp fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
    >
      <div className="worn-stamp-tile relative w-40 rounded-2xl bg-white border border-[var(--border)] shadow-[0_24px_60px_-20px_rgba(58,16,24,0.45)] overflow-hidden">
        <div className="bg-[var(--accent)] text-[var(--accent-ink)] text-center py-1.5 font-mono text-[11px] uppercase tracking-[0.12em]">
          {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short' })}
        </div>
        <div className="flex flex-col items-center px-3 pt-2 pb-3">
          <span className="font-poster text-5xl leading-none text-[var(--text)]">
            {date.getDate()}
          </span>
          <div className="mt-2 flex gap-1.5">
            {pieces.map((p, i) => (
              <span
                key={p.id}
                className="worn-stamp-piece w-10 h-10 rounded-md bg-[var(--muted)] overflow-hidden"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <ClothingImage src={p.image_url} alt="" className="w-full h-full object-contain" />
              </span>
            ))}
          </div>
        </div>
        <span className="worn-stamp-check absolute top-9 right-3 w-8 h-8 rounded-full bg-[var(--success)] text-white flex items-center justify-center">
          <Check size={18} strokeWidth={3} />
        </span>
      </div>
    </div>
  );
}
