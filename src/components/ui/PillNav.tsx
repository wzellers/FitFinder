'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';

export interface PillNavItem<K extends string> {
  key: K;
  label: string;
  icon: React.ElementType;
}

interface PillNavProps<K extends string> {
  items: PillNavItem<K>[];
  active: K;
  onChange: (key: K) => void;
}

/**
 * Floating navigation: a frosted pill with one highlight that slides to the
 * active tab. The highlight colours come from --pill-active / --pill-active-ink
 * so a theme (e.g. today's outfit) can recolour it.
 */
export default function PillNav<K extends string>({ items, active, onChange }: PillNavProps<K>) {
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<K, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const btn = buttonRefs.current.get(active);
      if (btn) setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [active]);

  return (
    <nav
      aria-label="Main"
      className="fixed z-40 bottom-[calc(1rem+env(safe-area-inset-bottom))] inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
    >
      <div
        ref={listRef}
        className="relative grid grid-cols-5 sm:flex rounded-full border border-black/[0.06] bg-white/80 p-1 shadow-[0_10px_34px_-8px_rgba(58,16,24,0.28)] backdrop-blur-xl"
      >
        {indicator && (
          <span
            aria-hidden="true"
            className="absolute top-1 bottom-1 rounded-full bg-[var(--pill-active)] transition-[left,width,background-color] duration-300 ease-[cubic-bezier(0.3,0.9,0.3,1)]"
            style={{ left: indicator.left, width: indicator.width }}
          />
        )}
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              ref={(el) => {
                if (el) buttonRefs.current.set(key, el);
                else buttonRefs.current.delete(key);
              }}
              onClick={() => onChange(key)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative z-10 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 min-h-[50px] sm:min-h-[42px] sm:px-5 rounded-full text-[11px] sm:text-sm font-medium transition-colors duration-300 ${
                isActive
                  ? 'text-[var(--pill-active-ink)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              <Icon
                size={18}
                strokeWidth={isActive ? 2.25 : 1.75}
                aria-hidden="true"
                className="sm:hidden"
              />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
