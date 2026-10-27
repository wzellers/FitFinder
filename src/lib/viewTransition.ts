// Animate a UI change with the browser's View Transitions API, where it
// exists and the user hasn't asked for reduced motion; otherwise just make
// the change.

import { flushSync } from 'react-dom';

/** The shared name a closet photo and the edit dialog's photo morph between. */
export const ITEM_PHOTO_TRANSITION = 'item-photo';

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

/**
 * Run `update` (React state changes) inside a view transition. The browser
 * snapshots the page before, `update` is flushed synchronously, and elements
 * sharing a `view-transition-name` morph from their old place to the new one.
 */
export function withViewTransition(update: () => void): void {
  const doc = typeof document === 'undefined' ? null : (document as TransitionDocument);
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!doc?.startViewTransition || reduce) {
    update();
    return;
  }
  doc.startViewTransition(() => flushSync(update));
}
