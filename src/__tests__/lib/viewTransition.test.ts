import { describe, it, expect, vi, afterEach } from 'vitest';
import { withViewTransition } from '@/lib/viewTransition';

// A loose view of document, so tests can add and remove the API.
const doc = document as unknown as { startViewTransition?: unknown };

afterEach(() => {
  delete doc.startViewTransition;
});

describe('withViewTransition', () => {
  it('just runs the update where View Transitions are unsupported', () => {
    const update = vi.fn();
    withViewTransition(update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('runs the update inside a view transition where supported', () => {
    const start = vi.fn((cb: () => void) => cb());
    doc.startViewTransition = start;
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
    const update = vi.fn();
    withViewTransition(update);
    expect(start).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('skips the animation for users who prefer reduced motion', () => {
    const start = vi.fn();
    doc.startViewTransition = start;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    const update = vi.fn();
    withViewTransition(update);
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
