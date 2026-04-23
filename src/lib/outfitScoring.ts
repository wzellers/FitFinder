// Outfit scoring engine — replaces random generation with weighted scoring

import type { ClothingItem, ColorCombination, OutfitWear, UserOccasionRules } from '@/lib/types';
import type { TemperatureCategory } from '@/lib/weatherApi';
import type { Occasion } from '@/lib/constants';
import { typeToSection, occasionRules } from '@/lib/constants';
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
  recentWears: OutfitWear[];
  occasion: Occasion | null;
  ratedOutfits: OutfitWear[];
  weatherRules?: Record<string, ClothingWeatherRules>;
  occasionRules?: UserOccasionRules;
}

// ============================================================================
// WEIGHTS
// ============================================================================

const WEIGHT = {
  COLOR_HARMONY: 0.30,
  WEATHER: 0.25,
  VARIETY: 0.20,
  OCCASION: 0.15,
  COMFORT: 0.10,
};

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

function pairMatchesLiked(colorA: string, colorB: string, liked: ColorCombination[]): boolean {
  return liked.some(
    (c) =>
      (c.topColor.toLowerCase() === colorA && c.bottomColor.toLowerCase() === colorB) ||
      (c.topColor.toLowerCase() === colorB && c.bottomColor.toLowerCase() === colorA),
  );
}

function colorHarmonyScore(
  top: ClothingItem,
  bottom: ClothingItem,
  liked: ColorCombination[],
): number {
  if (liked.length === 0) return 0.5; // neutral when no prefs set

  const topColor = top.colors[0]?.toLowerCase();
  const bottomColor = bottom.colors[0]?.toLowerCase();
  if (!topColor || !bottomColor) return 0.3;

  return pairMatchesLiked(topColor, bottomColor, liked) ? 1.0 : 0.3;
}

function weatherScore(
  top: ClothingItem,
  bottom: ClothingItem,
  weather: TemperatureCategory | null,
  customRules?: Record<string, ClothingWeatherRules>,
): number {
  if (!weather) return 0.5;

  const rules = getUserClothingWeatherRules(customRules);
  let score = 0.5;
  const items = [top, bottom];

  for (const item of items) {
    const r = rules[item.type];
    if (r && r.blockedIn.includes(weather)) return 0; // hard filter
    if (r && r.suggestedIn.includes(weather)) score += 0.15;
  }

  return Math.max(0, Math.min(1, score));
}

function varietyScore(
  top: ClothingItem,
  bottom: ClothingItem,
  shoes: ClothingItem,
  recentWears: OutfitWear[],
): number {
  if (recentWears.length === 0) return 0.5;

  const itemIds = [top.id, bottom.id, shoes.id];
  const recentIds = new Set<string>();
  recentWears.forEach((w) => {
    if (w.top_id) recentIds.add(w.top_id);
    if (w.bottom_id) recentIds.add(w.bottom_id);
    if (w.shoes_id) recentIds.add(w.shoes_id);
  });

  const overlap = itemIds.filter((id) => recentIds.has(id)).length;
  return Math.max(0, 1 - overlap * 0.25);
}

function occasionScore(
  top: ClothingItem,
  bottom: ClothingItem,
  occasion: Occasion | null,
  userRules?: UserOccasionRules,
): number {
  if (!occasion) return 0.5;

  const rules = userRules?.[occasion] ?? occasionRules[occasion];
  if (!rules) return 0.5;

  let score = 0;
  let count = 0;

  if (rules.tops.includes(top.type)) score += 1;
  count++;

  if (rules.bottoms.includes(bottom.type)) score += 1;
  count++;

  return count > 0 ? score / count : 0.5;
}

function comfortScore(
  top: ClothingItem,
  bottom: ClothingItem,
  shoes: ClothingItem,
  ratedOutfits: OutfitWear[],
): number {
  if (ratedOutfits.length === 0) return 0.5;

  const itemIds = new Set([top.id, bottom.id, shoes.id]);
  let totalRating = 0;
  let matchCount = 0;

  for (const wear of ratedOutfits) {
    const wearIds = [wear.top_id, wear.bottom_id, wear.shoes_id].filter(Boolean) as string[];
    const overlap = wearIds.filter((id) => itemIds.has(id)).length;
    if (overlap > 0) {
      const rating = (wear.comfort_rating ?? wear.rating ?? 5) / 10;
      totalRating += rating * (overlap / wearIds.length);
      matchCount++;
    }
  }

  return matchCount > 0 ? totalRating / matchCount : 0.5;
}

// ============================================================================
// MAIN SCORING
// ============================================================================

function scoreOutfit(
  top: ClothingItem,
  bottom: ClothingItem,
  shoes: ClothingItem,
  ctx: ScoringContext,
): number {
  const ch = colorHarmonyScore(top, bottom, ctx.likedCombinations) * WEIGHT.COLOR_HARMONY;
  const ws = weatherScore(top, bottom, ctx.weather, ctx.weatherRules) * WEIGHT.WEATHER;
  const vs = varietyScore(top, bottom, shoes, ctx.recentWears) * WEIGHT.VARIETY;
  const os = occasionScore(top, bottom, ctx.occasion, ctx.occasionRules) * WEIGHT.OCCASION;
  const cs = comfortScore(top, bottom, shoes, ctx.ratedOutfits) * WEIGHT.COMFORT;

  // If weather score is 0, the outfit is inappropriate — eliminate it
  if (ws === 0 && ctx.weather) return 0;

  return ch + ws + vs + os + cs;
}

// ============================================================================
// GENERATION
// ============================================================================

export function generateScoredOutfits(
  items: ClothingItem[],
  ctx: ScoringContext,
  count: number = 5,
): OutfitCandidate[] {
  const tops = items.filter((i) => typeToSection[i.type] === 'Tops');
  const bottoms = items.filter((i) => typeToSection[i.type] === 'Bottoms');
  const shoesItems = items.filter((i) => typeToSection[i.type] === 'Shoes');

  if (tops.length === 0 || bottoms.length === 0 || shoesItems.length === 0) return [];

  const candidates: OutfitCandidate[] = [];

  const maxCombos = Math.min(
    tops.length * bottoms.length * shoesItems.length,
    500,
  );

  const seen = new Set<string>();

  for (let i = 0; i < maxCombos * 3 && candidates.length < maxCombos; i++) {
    const top = tops[Math.floor(Math.random() * tops.length)];
    const bottom = bottoms[Math.floor(Math.random() * bottoms.length)];
    const shoes = shoesItems[Math.floor(Math.random() * shoesItems.length)];

    const key = `${top.id}-${bottom.id}-${shoes.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const score = scoreOutfit(top, bottom, shoes, ctx);
    if (score > 0) {
      candidates.push({ top, bottom, shoes, score });
    }
  }

  // Sort by score descending, return top N
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, count);
}
