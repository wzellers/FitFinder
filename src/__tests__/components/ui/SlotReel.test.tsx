import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import SlotReel from '@/components/ui/SlotReel';
import { makeTop } from '../../factories/clothingItem';

vi.mock('@/components/ui/ClothingImage', () => ({
  default: ({ src }: { src: string }) => <img alt="" src={src} />,
}));

const pool = Array.from({ length: 5 }, (_, i) => makeTop({ id: `t${i}`, image_url: `u${i}` }));

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
});
afterEach(() => vi.useRealTimers());

const imgs = (c: HTMLElement) => c.querySelectorAll('img').length;
const srcs = (c: HTMLElement) => [...c.querySelectorAll('img')].map((i) => i.getAttribute('src'));
const strip = (c: HTMLElement) => c.querySelector<HTMLElement>('[aria-hidden="true"] > div')!;

/** Spin `item` in from `direction` and return the strip as first painted. */
function spin(direction?: 'down' | 'left' | 'right') {
  const { container, rerender } = render(
    <SlotReel item={pool[0]} pool={pool} spinKey={0} durationMs={500} direction={direction} />,
  );
  rerender(
    <SlotReel item={pool[1]} pool={pool} spinKey={1} durationMs={500} direction={direction} />,
  );
  return container;
}

describe('SlotReel', () => {
  it('shows just the item until it is spun', () => {
    const { container } = render(<SlotReel item={pool[0]} pool={pool} spinKey={0} />);
    expect(imgs(container)).toBe(1);
  });

  it('spins through a strip on a new key, then settles on the item', () => {
    const { container, rerender } = render(
      <SlotReel item={pool[0]} pool={pool} spinKey={0} durationMs={500} />,
    );
    rerender(<SlotReel item={pool[1]} pool={pool} spinKey={1} durationMs={500} />);
    expect(imgs(container)).toBeGreaterThan(1);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(imgs(container)).toBe(1);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('u1');
  });

  it('spins on mount when it appeared because of a spin', () => {
    const { container } = render(
      <SlotReel item={pool[2]} pool={pool} spinKey={1} durationMs={500} spinOnMount />,
    );
    expect(imgs(container)).toBeGreaterThan(1);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(imgs(container)).toBe(1);
  });

  it('does not spin for users who prefer reduced motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    const { container, rerender } = render(<SlotReel item={pool[0]} pool={pool} spinKey={0} />);
    rerender(<SlotReel item={pool[1]} pool={pool} spinKey={1} />);
    expect(imgs(container)).toBe(1);
  });

  it('spins top to bottom by default: the item leads the strip, which starts at the far end', () => {
    const c = spin();
    expect(srcs(c)[0]).toBe('u1');
    expect(strip(c).style.transform).toMatch(/^translateY\(-\d/);
  });

  it('slides right to left for "left": the item trails the strip, which starts at 0', () => {
    const c = spin('left');
    expect(srcs(c).at(-1)).toBe('u1');
    expect(strip(c).style.transform).toBe('translateX(0%)');
  });

  it('slides left to right for "right": the item leads the strip, which starts at the far end', () => {
    const c = spin('right');
    expect(srcs(c)[0]).toBe('u1');
    expect(strip(c).style.transform).toMatch(/^translateX\(-\d/);
  });

  it('lands on the item whichever way it travels', () => {
    for (const direction of ['down', 'left', 'right'] as const) {
      const c = spin(direction);
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(srcs(c)).toEqual(['u1']);
    }
  });
});
