import { describe, it, expect } from 'vitest';
import { contrast, mix, themeFromOutfit, themeFromPairing } from '@/lib/outfitTheme';
import { colorMap, colorPalette } from '@/lib/constants';

const WHITE = '#ffffff';

describe('themeFromOutfit', () => {
  it('makes the top the main colour, the bottom the secondary and the shoes the third', () => {
    const t = themeFromOutfit('navy blue', 'light blue', 'white');
    expect(t.posterBg.toLowerCase()).toBe(colorMap['navy blue']);
    expect(t.posterTitle.toLowerCase()).toBe(colorMap['light blue']);
    expect(t.cutout.toLowerCase()).toBe(colorMap.white);
    expect(t.uiAccent.toLowerCase()).toBe(colorMap['navy blue']);
    expect(t.glow.toLowerCase()).toBe(colorMap['navy blue']);
    expect([t.top, t.bottom, t.shoes].map((c) => c.toLowerCase())).toEqual([
      colorMap['navy blue'],
      colorMap['light blue'],
      colorMap.white,
    ]);
  });

  it("deepens a pale top so buttons and links still read, keeping the top's hue", () => {
    const t = themeFromOutfit('light blue', 'navy blue', 'white');
    expect(contrast(t.uiAccent, WHITE)).toBeGreaterThanOrEqual(4.5);
    // Still a blue: darker than light blue, not a different colour.
    const [r, , b] = [1, 3, 5].map((i) => parseInt(t.uiAccent.slice(i, i + 2), 16));
    expect(b).toBeGreaterThan(r);
  });

  it('keeps every combination of top, bottom and shoes readable', () => {
    for (const top of colorPalette) {
      for (const bottom of colorPalette) {
        for (const shoes of colorPalette) {
          const t = themeFromOutfit(top, bottom, shoes);
          expect(contrast(t.posterFg, t.posterBg)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.posterTitle, t.posterBg)).toBeGreaterThanOrEqual(3);
          expect(contrast(t.accentInk, t.accent)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.accent, t.posterBg)).toBeGreaterThanOrEqual(3);
          expect(contrast(t.pillActiveInk, t.pillActive)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.uiAccent, WHITE)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.uiAccentInk, t.uiAccent)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.uiAccent, t.uiTint)).toBeGreaterThanOrEqual(3);
          expect(contrast(t.glow, WHITE)).toBeGreaterThanOrEqual(1.4);
        }
      }
    }
  });

  it('uses the bottom for the shoes when they have no colour', () => {
    expect(themeFromOutfit('red', 'black').shoes).toBe(themeFromOutfit('red', 'black').bottom);
    expect(themeFromPairing('red', 'black')).toEqual(themeFromOutfit('red', 'black'));
  });
});

describe('mix', () => {
  it('blends two colours', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});
