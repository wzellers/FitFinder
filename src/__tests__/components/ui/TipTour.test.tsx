import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import TipTour from '@/components/ui/TipTour';
import type { Tip } from '@/lib/tips';

const tips: Tip[] = [
  { target: 'a', title: 'First', body: 'About A' },
  { target: 'missing', title: 'Gone', body: 'Not on screen' },
  { target: 'b', title: 'Second', body: 'About B' },
];

function Screen({ onDone, withB = true }: { onDone: (shown: boolean) => void; withB?: boolean }) {
  return (
    <>
      <button data-tour="a">A</button>
      {withB && <button data-tour="b">B</button>}
      <TipTour tips={tips} onDone={onDone} />
    </>
  );
}

/** Let the tour give up waiting for missing targets. */
async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(3500);
  });
}

describe('TipTour', () => {
  it('steps through the tips whose elements are on screen', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Screen onDone={onDone} />);
    await settle();
    expect(screen.getByRole('dialog', { name: 'First' })).toHaveTextContent('Tip 1 of 2');
    expect(screen.getByText('About A')).toBeInTheDocument();
    expect(screen.queryByText('Gone')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'Second' })).toHaveTextContent('Tip 2 of 2');
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('dialog', { name: 'First' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onDone).toHaveBeenCalledWith(true);
    vi.useRealTimers();
  });

  it('can be skipped with the close button or Escape', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { unmount } = render(<Screen onDone={onDone} />);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tips' }));
    expect(onDone).toHaveBeenLastCalledWith(true);
    unmount();

    onDone.mockClear();
    render(<Screen onDone={onDone} />);
    await settle();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDone).toHaveBeenLastCalledWith(true);
    vi.useRealTimers();
  });

  it('moves with the arrow keys', async () => {
    vi.useFakeTimers();
    render(<Screen onDone={vi.fn()} />);
    await settle();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Second' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('dialog', { name: 'Second' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('dialog', { name: 'First' })).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('starts at once when every element is there', () => {
    render(
      <>
        <button data-tour="a">A</button>
        <TipTour tips={[tips[0]]} onDone={vi.fn()} />
      </>,
    );
    expect(screen.getByRole('dialog', { name: 'First' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Got it' })).toHaveFocus();
  });

  it('ends without showing anything when nothing it points at is on screen', async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<TipTour tips={tips} onDone={onDone} />);
    await settle();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onDone).toHaveBeenCalledWith(false);
    vi.useRealTimers();
  });
});
