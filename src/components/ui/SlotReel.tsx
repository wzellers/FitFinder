'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ClothingImage from '@/components/ui/ClothingImage';
import type { ClothingItem } from '@/lib/types';

const REEL_LENGTH = 10;

/** Which way the reel's items travel: `down` for a full spin (items come in
 * from the top), `left` / `right` when one piece is swapped by an arrow or a
 * swipe, so it moves the way the user pointed. */
export type ReelDirection = 'down' | 'left' | 'right';

interface SlotReelProps {
  /** The item the reel lands on. */
  item: ClothingItem;
  /** Items to flash past while spinning (e.g. every clean top). */
  pool: ClothingItem[];
  /** Change this to spin; the reel stays still while it is unchanged. */
  spinKey: number;
  /** How long this reel spins, so rows can land one after another. */
  durationMs?: number;
  /** Spin when first shown (the reel appeared because of a spin). */
  spinOnMount?: boolean;
  /** Which way the items travel (default `down`). */
  direction?: ReelDirection;
}

/**
 * A slot-machine reel of clothing photos: on each spin it scrolls through
 * random items from the pool and lands on `item`. Users who prefer reduced
 * motion just see the result.
 */
export default function SlotReel({
  item,
  pool,
  spinKey,
  durationMs = 900,
  spinOnMount = false,
  direction = 'down',
}: SlotReelProps) {
  const [phase, setPhase] = useState<'idle' | 'reset' | 'spin'>(spinOnMount ? 'reset' : 'idle');
  // The key the reel was first shown with; it only spins for later keys,
  // unless it appeared because of a spin.
  const initialKey = useRef(spinKey);
  const spinInitially = useRef(spinOnMount);

  // The strip: random pool items, ending on the chosen one. Rebuilt per spin.
  const strip = useMemo(() => {
    const others = pool.filter((p) => p.id !== item.id);
    const picks: ClothingItem[] = [];
    for (let i = 0; i < REEL_LENGTH - 1 && others.length > 0; i++) {
      picks.push(others[Math.floor(Math.random() * others.length)]);
    }
    return [...picks, item];
    // spinKey intentionally rebuilds the strip for every spin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, spinKey]);

  useEffect(() => {
    if (spinKey === initialKey.current && !spinInitially.current) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || strip.length < 2) {
      setPhase('idle');
      return;
    }
    setPhase('reset');
    // Two frames: paint the strip at its start, then animate to its end.
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('spin')));
    const done = setTimeout(() => setPhase('idle'), durationMs + 50);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [spinKey, strip.length, durationMs]);

  if (phase === 'idle') {
    return (
      <ClothingImage src={item.image_url} alt="" className="w-full h-full object-contain p-1.5" />
    );
  }

  // The strip travels toward `direction` and stops on the chosen item, so for
  // `down` and `right` the item leads the strip and the reel starts at the far
  // end; for `left` it trails the strip and the reel starts at the near end.
  const n = strip.length;
  const itemFirst = direction !== 'left';
  const ordered = itemFirst ? [item, ...strip.slice(0, -1).reverse()] : strip;
  const far = `-${((n - 1) / n) * 100}%`;
  const offset = phase === 'spin' ? (itemFirst ? '0%' : far) : itemFirst ? far : '0%';
  const vertical = direction === 'down';
  return (
    <div className="w-full h-full overflow-hidden" aria-hidden="true">
      <div
        className={vertical ? 'flex flex-col' : 'flex flex-row h-full'}
        style={{
          ...(vertical ? { height: `${n * 100}%` } : { width: `${n * 100}%` }),
          transform: vertical ? `translateY(${offset})` : `translateX(${offset})`,
          transition:
            phase === 'spin'
              ? `transform ${durationMs}ms cubic-bezier(0.15, 0.85, 0.25, 1.04)`
              : 'none',
        }}
      >
        {ordered.map((p, i) => (
          <div
            key={`${p.id}-${i}`}
            style={vertical ? { height: `${100 / n}%` } : { width: `${100 / n}%` }}
            className="shrink-0"
          >
            <ClothingImage
              src={p.image_url}
              alt=""
              className="w-full h-full object-contain p-1.5"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
