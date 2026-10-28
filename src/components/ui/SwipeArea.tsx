'use client';

import React, { useRef } from 'react';

export type SwipeDirection = 'left' | 'right';

/** How far a finger or mouse must travel sideways to count as a swipe. */
const SWIPE_PX = 40;
/** How much sideways trackpad scrolling counts as a swipe, and the pause after
 * one so a single gesture's momentum doesn't swipe again. */
const WHEEL_PX = 60;
const WHEEL_COOLDOWN_MS = 600;

interface SwipeAreaProps {
  /** Called with the direction the content should move. */
  onSwipe: (direction: SwipeDirection) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Turns a sideways swipe into `onSwipe('left' | 'right')`: a finger or mouse
 * drag, or a two-finger trackpad swipe. Vertical movement is left alone, so
 * the page still scrolls. A click that ends a drag is swallowed, so a swipe
 * on a button doesn't also press it.
 */
export default function SwipeArea({ onSwipe, disabled, className, children }: SwipeAreaProps) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const wheel = useRef({ dx: 0, quietUntil: 0 });

  return (
    <div
      className={className}
      // pan-y: vertical touch scrolling still works; sideways goes to us. No
      // text selection, so a mouse swipe doesn't highlight the page.
      style={{ touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none' }}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
        swiped.current = false;
      }}
      onPointerUp={(e) => {
        const from = start.current;
        start.current = null;
        if (!from || disabled) return;
        const dx = e.clientX - from.x;
        const dy = e.clientY - from.y;
        if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > 2 * Math.abs(dy)) {
          swiped.current = true;
          onSwipe(dx < 0 ? 'left' : 'right');
        }
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onWheel={(e) => {
        if (disabled || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
        const now = Date.now();
        const w = wheel.current;
        if (now < w.quietUntil) return;
        w.dx += e.deltaX;
        if (Math.abs(w.dx) >= WHEEL_PX) {
          // Scrolling right (fingers moving left) moves the content left.
          onSwipe(w.dx > 0 ? 'left' : 'right');
          w.dx = 0;
          w.quietUntil = now + WHEEL_COOLDOWN_MS;
        }
      }}
      // Dragging a photo would start the browser's own image drag and cancel
      // the swipe.
      onDragStart={(e) => e.preventDefault()}
      onClickCapture={(e) => {
        if (swiped.current) {
          e.preventDefault();
          e.stopPropagation();
          swiped.current = false;
        }
      }}
    >
      {children}
    </div>
  );
}
