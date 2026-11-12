// The first-run setup: what each answer turns into.

import { typeToSection } from '@/lib/constants';
import { TEMPERATURE_THRESHOLDS } from '@/lib/weatherApi';
import type { ClothingItem, ClothingSection, ColorCombination } from '@/lib/types';

export type RunsAs = 'cold' | 'normal' | 'warm';

/** How many degrees "I run cold" / "I run warm" moves every threshold. */
export const RUNS_SHIFT = 5;

/**
 * Weather thresholds for how the user feels the temperature. Someone who runs
 * cold wants layers up to a warmer day, so their thresholds move up.
 */
export function thresholdsFor(runs: RunsAs) {
  const shift = runs === 'cold' ? RUNS_SHIFT : runs === 'warm' ? -RUNS_SHIFT : 0;
  return {
    cold: TEMPERATURE_THRESHOLDS.COLD + shift,
    cool: TEMPERATURE_THRESHOLDS.COOL + shift,
    warm: TEMPERATURE_THRESHOLDS.WARM + shift,
  };
}

/** Colour pairings offered in setup, as liked top / bottom combinations. */
export const STARTER_PAIRINGS: ColorCombination[] = [
  { topColor: 'white', bottomColor: 'denim' },
  { topColor: 'navy blue', bottomColor: 'beige' },
  { topColor: 'black', bottomColor: 'gray' },
  { topColor: 'dark green', bottomColor: 'beige' },
  { topColor: 'light blue', bottomColor: 'navy blue' },
  { topColor: 'gray', bottomColor: 'black' },
];

/** Pieces wanted per section before the closet has some variety. */
export const VARIETY_TARGET = 3;

/** How many pieces of each section the closet has, and whether that makes an outfit. */
export function closetProgress(items: Pick<ClothingItem, 'type'>[]) {
  const counts: Record<ClothingSection, number> = { Tops: 0, Bottoms: 0, Shoes: 0 };
  for (const item of items) {
    const section = typeToSection[item.type];
    if (section) counts[section]++;
  }
  return { counts, canMakeOutfit: counts.Tops > 0 && counts.Bottoms > 0 && counts.Shoes > 0 };
}
