import { describe, it, expect } from 'vitest';
import { contrast, themeFromPairing } from '@/lib/outfitTheme';
import { colorPalette } from '@/lib/constants';

describe('themeFromPairing', () => {
  it('uses the bottom colour for the block and the top colour for the title', () => {
    const t = themeFromPairing('light blue', 'navy blue');
    expect(t.posterTitle.toLowerCase()).toBe('#9fc9e6');
    expect(t.posterBg.toLowerCase()).toBe('#1f2a4a');
  });

  it('keeps every combination readable', () => {
    for (const top of colorPalette) {
      for (const bottom of colorPalette) {
        const t = themeFromPairing(top, bottom);
        expect(contrast(t.posterFg, t.posterBg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.posterTitle, t.posterBg)).toBeGreaterThanOrEqual(3);
        expect(contrast(t.pillActiveInk, t.pillActive)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.accentInk, t.accent)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.accent, t.posterBg)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
