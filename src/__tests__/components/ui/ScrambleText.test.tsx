import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import ScrambleText from '@/components/ui/ScrambleText';

afterEach(() => vi.useRealTimers());

describe('ScrambleText', () => {
  it('gives assistive tech the final text and settles visually', () => {
    vi.useFakeTimers();
    const { container } = render(<ScrambleText text="Polo" speed={10} frames={2} />);
    expect(container.querySelector('.sr-only')?.textContent).toBe('Polo');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('Polo');
  });

  it('re-runs when the text changes', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<ScrambleText text="Polo" speed={10} frames={2} />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender(<ScrambleText text="Jeans" speed={10} frames={2} />);
    expect(container.querySelector('.sr-only')?.textContent).toBe('Jeans');
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('Jeans');
  });
});
