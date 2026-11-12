// First-visit tips: a few spotlighted pointers the first time each screen opens.
//
// Which screens' tips were seen is kept in this browser (localStorage), so a
// new device shows them again. Each tip points at an element with a matching
// `data-tour` attribute; tips whose element isn't on screen are left out.

import type { DashboardTab } from '@/lib/types';

export interface Tip {
  /** The `data-tour` value of the element to spotlight. */
  target: string;
  title: string;
  body: string;
}

export const TIPS: Record<DashboardTab, Tip[]> = {
  generator: [
    {
      target: 'outfit',
      title: 'Swap one piece',
      body: 'Swipe a piece sideways, or use its arrows, to change just that one. Tap it to choose it yourself.',
    },
    {
      target: 'keep',
      title: 'Keep what you love',
      body: 'Keep a piece and Try another changes only the rest.',
    },
    {
      target: 'try-another',
      title: 'Not feeling it?',
      body: 'Try another spins a new outfit. Each skip teaches FitFinder a little.',
    },
    {
      target: 'rate',
      title: 'Rate it',
      body: 'Ratings teach FitFinder your taste fastest. You can rate an outfit without wearing it.',
    },
    {
      target: 'outfit-actions',
      title: 'Wear it, save it, share it',
      body: 'Wear today logs it in your Calendar. Save keeps it for later. Share makes an image.',
    },
  ],
  closet: [
    {
      target: 'add-items',
      title: 'Add more clothes',
      body: 'Or drop and paste photos anywhere on this screen.',
    },
    {
      target: 'closet-item',
      title: 'Edit or reorder',
      body: 'Tap a piece to fix its type and colours, or re-crop the photo. Drag it to put your closet in your own order.',
    },
    {
      target: 'dirty-toggle',
      title: 'In the wash',
      body: 'Mark pieces dirty and FitFinder leaves them out until they’re clean.',
    },
  ],
  calendar: [
    {
      target: 'calendar-today',
      title: 'Your outfit diary',
      body: 'Log what you wore on any day, and rate it. Past ratings teach FitFinder too.',
    },
  ],
  stats: [
    {
      target: 'stats-customize',
      title: 'Your numbers',
      body: 'Streaks, go-to pairings and what you actually wear. Customize picks which cards show.',
    },
  ],
  preferences: [
    {
      target: 'settings-sections',
      title: 'Make it yours',
      body: 'Weather rules, occasions, colour pairings, the daily email and effects. Show tips again is under Effects.',
    },
  ],
};

export const TIPS_SEEN_KEY = 'fitfinder:tips-seen';
/** Fired on window when the tips are reset, so the open screen shows its tips again. */
export const TIPS_RESET_EVENT = 'fitfinder:tips-reset';

export function tipsSeen(): Set<DashboardTab> {
  try {
    const raw = JSON.parse(localStorage.getItem(TIPS_SEEN_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw : []);
  } catch {
    return new Set();
  }
}

export function markTipsSeen(tab: DashboardTab) {
  try {
    localStorage.setItem(TIPS_SEEN_KEY, JSON.stringify([...tipsSeen().add(tab)]));
  } catch {
    // Storage blocked: the tips show again next time, which is harmless.
  }
}

export function resetTips() {
  try {
    localStorage.removeItem(TIPS_SEEN_KEY);
  } catch {
    // Nothing stored to clear.
  }
  window.dispatchEvent(new Event(TIPS_RESET_EVENT));
}
