import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import LiveClock from '@/components/ui/LiveClock';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 27, 15, 4, 5));
});
afterEach(() => vi.useRealTimers());

const time = () => screen.getByRole('button').querySelector('time')!.textContent;

describe('LiveClock', () => {
  it('shows 12-hour time by default', () => {
    render(<LiveClock />);
    expect(time()).toBe('3:04:05 PM');
  });

  it('switches to 24-hour time on click, and remembers it', () => {
    const { unmount } = render(<LiveClock />);
    fireEvent.click(screen.getByRole('button', { name: /Switch to 24-hour time/ }));
    expect(time()).toBe('15:04:05');
    unmount();
    render(<LiveClock />);
    expect(time()).toBe('15:04:05');
    fireEvent.click(screen.getByRole('button', { name: /Switch to 12-hour time/ }));
    expect(time()).toBe('3:04:05 PM');
  });

  it('ticks every second', () => {
    render(<LiveClock />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(time()).toBe('3:04:06 PM');
  });
});
