import { describe, it, expect } from 'vitest';
import { closetProgress, RUNS_SHIFT, STARTER_PAIRINGS, thresholdsFor } from '@/lib/onboarding';
import { colorMap } from '@/lib/constants';
import { TEMPERATURE_THRESHOLDS } from '@/lib/weatherApi';
import { makeBottom, makeShoes, makeTop } from '../factories/clothingItem';

describe('thresholdsFor', () => {
  it('keeps the defaults for someone who feels the temperature normally', () => {
    expect(thresholdsFor('normal')).toEqual({
      cold: TEMPERATURE_THRESHOLDS.COLD,
      cool: TEMPERATURE_THRESHOLDS.COOL,
      warm: TEMPERATURE_THRESHOLDS.WARM,
    });
  });

  it('raises every threshold for someone who runs cold, and lowers them for warm', () => {
    const normal = thresholdsFor('normal');
    const cold = thresholdsFor('cold');
    const warm = thresholdsFor('warm');
    for (const k of ['cold', 'cool', 'warm'] as const) {
      expect(cold[k]).toBe(normal[k] + RUNS_SHIFT);
      expect(warm[k]).toBe(normal[k] - RUNS_SHIFT);
    }
  });
});

describe('closetProgress', () => {
  it('counts pieces per section and knows when they make an outfit', () => {
    const start = closetProgress([makeTop(), makeTop(), makeBottom()]);
    expect(start.counts).toEqual({ Tops: 2, Bottoms: 1, Shoes: 0 });
    expect(start.canMakeOutfit).toBe(false);
    expect(closetProgress([makeTop(), makeBottom(), makeShoes()]).canMakeOutfit).toBe(true);
  });

  it('ignores types it does not know', () => {
    expect(closetProgress([{ type: 'Cape' }]).counts).toEqual({ Tops: 0, Bottoms: 0, Shoes: 0 });
  });
});

describe('STARTER_PAIRINGS', () => {
  it('only uses colours from the palette, with no repeats', () => {
    for (const p of STARTER_PAIRINGS) {
      expect(colorMap[p.topColor]).toBeTruthy();
      expect(colorMap[p.bottomColor]).toBeTruthy();
    }
    const keys = STARTER_PAIRINGS.map((p) => `${p.topColor}|${p.bottomColor}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
