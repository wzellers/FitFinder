import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import WornStamp, { WORN_STAMP_MS } from '@/components/ui/WornStamp';
import { makeBottom, makeShoes, makeTop } from '../../factories/clothingItem';

vi.mock('@/components/ui/ClothingImage', () => ({
  default: ({ src }: { src: string }) => <img alt="" src={src} />,
}));

afterEach(() => vi.useRealTimers());

describe('WornStamp', () => {
  it("shows the day with the outfit's pieces, then finishes on its own", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const pieces = [makeTop({ image_url: 't' }), makeBottom({ image_url: 'b' }), makeShoes()];
    render(<WornStamp pieces={pieces} date={new Date(2026, 9, 27)} onDone={onDone} />);

    const stamp = screen.getByTestId('worn-stamp');
    expect(stamp.textContent).toContain('27');
    expect(stamp.querySelectorAll('img')).toHaveLength(3);
    // Decorative: the toast says what happened.
    expect(stamp.getAttribute('aria-hidden')).toBe('true');

    act(() => {
      vi.advanceTimersByTime(WORN_STAMP_MS - 1);
    });
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
