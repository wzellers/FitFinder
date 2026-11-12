'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { Tip } from '@/lib/tips';

interface TipTourProps {
  tips: Tip[];
  /** Called when the tour ends: finished or skipped (`shown` true), or nothing to point at. */
  onDone: (shown: boolean) => void;
}

const PAD = 8;
const CARD_H = 200;
const GAP = 12;
/** How long to wait for a screen's tip targets to appear. */
const WAIT_MS = 3000;

const targetOf = (tip: Tip) => document.querySelector(`[data-tour="${tip.target}"]`);

/**
 * A spotlight tour: dims the screen around one element at a time, with a card
 * explaining it. Tips whose element isn't on screen are left out.
 */
export default function TipTour({ tips, onDone }: TipTourProps) {
  // The tips to show, once the screen has loaded: wait (briefly) for every
  // target, then keep the ones that turned up.
  const [shown, setShown] = useState<Tip[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const tip = shown?.[index];

  useEffect(() => {
    const started = Date.now();
    const check = () => {
      const present = tips.filter((t) => targetOf(t));
      if (present.length === tips.length || Date.now() - started >= WAIT_MS) {
        setShown(present);
        return true;
      }
      return false;
    };
    if (check()) return;
    const timer = setInterval(() => check() && clearInterval(timer), 150);
    return () => clearInterval(timer);
  }, [tips]);

  useEffect(() => {
    if (shown?.length === 0) onDone(false);
  }, [shown, onDone]);

  useEffect(() => {
    if (tip) targetOf(tip)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [tip]);

  // Focus the card's main button once it's on screen, and again for each tip.
  const placed = rect !== null;
  useEffect(() => {
    if (placed) nextRef.current?.focus();
  }, [tip, placed]);

  // Follow the target while the page scrolls or the layout shifts.
  useLayoutEffect(() => {
    if (!tip) return;
    let raf = 0;
    const measure = () => {
      const r = targetOf(tip)?.getBoundingClientRect() ?? null;
      setRect((prev) =>
        prev &&
        r &&
        prev.x === r.x &&
        prev.y === r.y &&
        prev.width === r.width &&
        prev.height === r.height
          ? prev
          : r,
      );
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [tip]);

  const count = shown?.length ?? 0;
  const last = index === count - 1;
  const next = () => (last ? onDone(true) : setIndex(index + 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone(true);
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, count - 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone, count]);

  if (!shown || !tip || !rect) return null;

  // The card goes below the target if it fits, else above, else pinned on screen.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(320, vw - 2 * GAP);
  const top =
    vh - rect.bottom - PAD - GAP >= CARD_H
      ? rect.bottom + PAD + GAP
      : rect.top - PAD - GAP >= CARD_H
        ? rect.top - PAD - GAP - CARD_H
        : vh - CARD_H - GAP;
  const left = Math.min(Math.max(GAP, rect.left + rect.width / 2 - cardW / 2), vw - cardW - GAP);

  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tip-title"
      aria-describedby="tip-body"
      data-testid="tip-tour"
    >
      {/* Clicks around the spotlight are swallowed, so the tour stays in charge. */}
      <div className="absolute inset-0" />
      <div
        aria-hidden="true"
        className="absolute rounded-2xl pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.3,0.9,0.3,1)]"
        style={{
          left: rect.left - PAD,
          top: rect.top - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          boxShadow: '0 0 0 9999px rgba(20, 30, 40, 0.55), 0 0 0 3px var(--accent)',
        }}
      />
      <div
        key={index}
        className="page-in absolute panel p-4 shadow-2xl flex flex-col transition-all duration-300"
        style={{ width: cardW, left, top, minHeight: CARD_H }}
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <p className="readout">
            Tip {index + 1} of {shown.length}
          </p>
          <button
            onClick={() => onDone(true)}
            aria-label="Skip tips"
            className="-mt-1 -mr-1 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--muted)]"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <h2 id="tip-title" className="text-base font-semibold mb-1">
          {tip.title}
        </h2>
        <p id="tip-body" className="text-sm text-[var(--text-secondary)] mb-4">
          {tip.body}
        </p>
        <div className="mt-auto flex items-center gap-2">
          <div className="flex gap-1 mr-auto" aria-hidden="true">
            {shown.map((t, i) => (
              <span
                key={t.target}
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? 'w-4 bg-[var(--accent)]'
                    : 'w-1.5 bg-[var(--line-strong)] opacity-50'
                }`}
              />
            ))}
          </div>
          {index > 0 && (
            <button onClick={() => setIndex(index - 1)} className="btn-ghost !min-h-[40px] px-3">
              Back
            </button>
          )}
          <button ref={nextRef} onClick={next} className="btn-primary !min-h-[40px] px-4">
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
