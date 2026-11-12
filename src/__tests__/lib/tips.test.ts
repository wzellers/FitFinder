import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TIPS,
  TIPS_RESET_EVENT,
  TIPS_SEEN_KEY,
  markTipsSeen,
  resetTips,
  tipsSeen,
} from '@/lib/tips';

beforeEach(() => localStorage.clear());

describe('tips', () => {
  it('has tips for every screen, each pointing at its own element', () => {
    for (const tips of Object.values(TIPS)) {
      expect(tips.length).toBeGreaterThan(0);
      const targets = tips.map((t) => t.target);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });

  it('remembers which screens’ tips were seen', () => {
    expect(tipsSeen().size).toBe(0);
    markTipsSeen('closet');
    markTipsSeen('generator');
    markTipsSeen('closet');
    expect([...tipsSeen()].sort()).toEqual(['closet', 'generator']);
  });

  it('treats anything unreadable as nothing seen', () => {
    localStorage.setItem(TIPS_SEEN_KEY, '{not json');
    expect(tipsSeen().size).toBe(0);
    localStorage.setItem(TIPS_SEEN_KEY, '"closet"');
    expect(tipsSeen().size).toBe(0);
  });

  it('resets them all and tells the open screen', () => {
    markTipsSeen('stats');
    const heard = vi.fn();
    window.addEventListener(TIPS_RESET_EVENT, heard);
    resetTips();
    window.removeEventListener(TIPS_RESET_EVENT, heard);
    expect(tipsSeen().size).toBe(0);
    expect(heard).toHaveBeenCalledOnce();
  });

  it('carries on when storage is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => markTipsSeen('closet')).not.toThrow();
    spy.mockRestore();
  });
});
