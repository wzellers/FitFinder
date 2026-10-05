'use client';

import React, { useEffect, useRef, useState } from 'react';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+-/<>=';

interface ScrambleTextProps {
  text: string;
  className?: string;
  /** Milliseconds between frames. */
  speed?: number;
  /** Frames each character scrambles before it settles (staggered left to right). */
  frames?: number;
}

/**
 * Text that cycles through random glyphs and settles into place whenever it
 * changes, like a terminal decrypting. Inspired by React Bits' DecryptedText,
 * but replays on every text change and has no dependencies. Screen readers
 * get the final text only; reduced-motion users see it immediately.
 */
export default function ScrambleText({
  text,
  className = '',
  speed = 32,
  frames = 6,
}: ScrambleTextProps) {
  const [display, setDisplay] = useState(text);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !text) {
      setDisplay(text);
      return;
    }

    let frame = 0;
    const total = text.length + frames;
    timer.current = setInterval(() => {
      frame += 1;
      setDisplay(
        text
          .split('')
          .map((ch, i) => {
            if (ch === ' ' || frame >= i + frames) return ch;
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join(''),
      );
      if (frame >= total && timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    }, speed);

    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [text, speed, frames]);

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{display}</span>
    </span>
  );
}
