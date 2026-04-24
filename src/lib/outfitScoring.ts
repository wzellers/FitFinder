// Outfit generation — filter by weather & color preferences, then pick randomly

import type { ClothingItem, ColorCombination } from '@/lib/types';
import type { TemperatureCategory } from '@/lib/weatherApi';
import { typeToSection } from '@/lib/constants';
import { getUserClothingWeatherRules } from '@/lib/weatherApi';
import type { ClothingWeatherRules } from '@/lib/types';

// ============================================================================
// TYPES
// ============================================================================

export interface OutfitCandidate {
  top: ClothingItem;
  bottom: ClothingItem;
  shoes: ClothingItem;
  score: number;
}

export interface ScoringContext {
  likedCombinations: ColorCombination[];
  weather: TemperatureCategory | null;
  weatherRules?: Record<string, ClothingWeatherRules>;
}

// ============================================================================
// HELPERS
// ============================================================================

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pairMatchesLiked(topColor: string, bottomColor: string, liked: ColorCombination[]): boolean {
  return liked.some(
    (c) =>
      (c.topColor.toLowerCase() === topColor && c.bottomColor.toLowerCase() === bottomColor) ||
      (c.topColor.toLowerCase() === bottomColor && c.bottomColor.toLowerCase() === topColor),
  );
}

// ============================================================================
// GENERATION
// ============================================================================

export function generateScoredOutfits(
  items: ClothingItem[],
  ctx: ScoringContext,
  count: number = 5,
): OutfitCandidate[] {
  // 1. Categorize items
  let tops = items.filter((i) => typeToSection[i.type] === 'Tops');
  let bottoms = items.filter((i) => typeToSection[i.type] === 'Bottoms');
  let shoesItems = items.filter((i) => typeToSection[i.type] === 'Shoes');

  if (tops.length === 0 || bottoms.length === 0 || shoesItems.length === 0) return [];

  // 2. Weather filter — remove blocked items
  if (ctx.weather) {
    const rules = getUserClothingWeatherRules(ctx.weatherRules);
    tops = tops.filter((i) => {
      const r = rules[i.type];
      return !r || !r.blockedIn.includes(ctx.weather!);
    });
    bottoms = bottoms.filter((i) => {
      const r = rules[i.type];
      return !r || !r.blockedIn.includes(ctx.weather!);
    });
    shoesItems = shoesItems.filter((i) => {
      const r = rules[i.type];
      return !r || !r.blockedIn.includes(ctx.weather!);
    });
  }

  if (tops.length === 0 || bottoms.length === 0 || shoesItems.length === 0) return [];

  // 3. Build valid top+bottom pairs based on color preferences
  type Pair = [ClothingItem, ClothingItem];
  let validPairs: Pair[] = [];

  if (ctx.likedCombinations.length > 0) {
    // Only allow pairs matching a liked color combination
    for (const top of tops) {
      for (const bottom of bottoms) {
        const tc = top.colors[0]?.toLowerCase();
        const bc = bottom.colors[0]?.toLowerCase();
        if (tc && bc && pairMatchesLiked(tc, bc, ctx.likedCombinations)) {
          validPairs.push([top, bottom]);
        }
      }
    }
    // If nothing matches preferences, fall back to all pairs
    if (validPairs.length === 0) {
      for (const top of tops) {
        for (const bottom of bottoms) {
          validPairs.push([top, bottom]);
        }
      }
    }
  } else {
    // No color preferences — all pairs valid
    for (const top of tops) {
      for (const bottom of bottoms) {
        validPairs.push([top, bottom]);
      }
    }
  }

  // 4. Shuffle pairs and shoes, then pick random outfits
  validPairs = shuffle(validPairs);
  const shuffledShoes = shuffle(shoesItems);

  const results: OutfitCandidate[] = [];
  const seen = new Set<string>();

  for (const [top, bottom] of validPairs) {
    if (results.length >= count) break;
    const shoes = shuffledShoes[results.length % shuffledShoes.length];
    const key = `${top.id}-${bottom.id}-${shoes.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ top, bottom, shoes, score: 1 });
  }

  return results;
}
