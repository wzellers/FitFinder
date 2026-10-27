import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import SwipeArea from '@/components/ui/SwipeArea';

// jsdom has no PointerEvent; a MouseEvent carries the coordinates we need.
beforeAll(() => {
  if (!('PointerEvent' in window)) {
    (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = class extends (
      MouseEvent
    ) {};
  }
});
afterEach(() => vi.useRealTimers());

function setup(disabled = false) {
  const onSwipe = vi.fn();
  const onClick = vi.fn();
  render(
    <SwipeArea onSwipe={onSwipe} disabled={disabled}>
      <button onClick={onClick}>Piece</button>
    </SwipeArea>,
  );
  const button = screen.getByRole('button', { name: 'Piece' });
  const drag = (dx: number, dy = 0) => {
    fireEvent.pointerDown(button, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(button, { clientX: 100 + dx, clientY: 100 + dy });
  };
  return { onSwipe, onClick, button, drag };
}

describe('SwipeArea', () => {
  it('reports a drag to the left or right as that direction', () => {
    const { onSwipe, drag } = setup();
    drag(-80);
    drag(80);
    expect(onSwipe.mock.calls).toEqual([['left'], ['right']]);
  });

  it('ignores short or mostly vertical drags', () => {
    const { onSwipe, drag } = setup();
    drag(20);
    drag(60, 80);
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('swallows the click that ends a swipe, but not a plain click', () => {
    const { onClick, button, drag } = setup();
    drag(-80);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    fireEvent.pointerDown(button, { clientX: 100, clientY: 100 });
    fireEvent.pointerUp(button, { clientX: 101, clientY: 100 });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('turns a sideways trackpad swipe into one swipe, then pauses for its momentum', () => {
    vi.useFakeTimers();
    const { onSwipe, button } = setup();
    fireEvent.wheel(button, { deltaX: 40, deltaY: 0 });
    expect(onSwipe).not.toHaveBeenCalled();
    fireEvent.wheel(button, { deltaX: 40, deltaY: 0 });
    expect(onSwipe).toHaveBeenLastCalledWith('left');
    fireEvent.wheel(button, { deltaX: 200, deltaY: 0 }); // momentum
    expect(onSwipe).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(700);
    fireEvent.wheel(button, { deltaX: -100, deltaY: 0 });
    expect(onSwipe).toHaveBeenLastCalledWith('right');
  });

  it('leaves vertical scrolling alone', () => {
    const { onSwipe, button } = setup();
    fireEvent.wheel(button, { deltaX: 30, deltaY: 120 });
    fireEvent.wheel(button, { deltaX: 30, deltaY: 120 });
    fireEvent.wheel(button, { deltaX: 30, deltaY: 120 });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', () => {
    const { onSwipe, button, drag } = setup(true);
    drag(-80);
    fireEvent.wheel(button, { deltaX: 200, deltaY: 0 });
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("stops the browser's own image drag, which would cancel a mouse swipe", () => {
    const { button } = setup();
    expect(fireEvent.dragStart(button)).toBe(false); // default prevented
  });
});
