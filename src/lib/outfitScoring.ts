// Outfit scoring engine — replaces random generation with weighted scoring

import type { ClothingItem, ColorCombination, OutfitWear } from '@/lib/types';
import type { TemperatureCategory } from '@/lib/weatherApi';
import type { Occasion } from '@/lib/constants';
import { typeToSection, occasionRules } from '@/lib/constants';
import { isClothingAppropriateForWeather, isClothingSuggestedForWeather, isOuterwearRequired, isOuterwearSuggested } from '@/lib/types';

// ============================================================================
// TYPES
// ============================================================================

export interface OutfitCandidate {
  top: ClothingItem;
  outerwear: ClothingItem | null;
  bottom: ClothingItem;
  shoes: ClothingItem;
  score: number;
}

interface ScoringContext {
  likedCombinations: ColorCombination[];
  weather: TemperatureCategory | null;
  recentWears: OutfitWear[];
  occasion: Occasion | null;
  ratedOutfits: OutfitWear[];
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

function colorHarmonyScore(
  top: ClothingItem,
  bottom: ClothingItem,
  outerwear: ClothingItem | null,
  liked: ColorCombination[],
): number {
  if (liked.length === 0) return 0.5; // neutral when no prefs set

  const topColor = top.colors[0]?.toLowerCase();
  const bottomColor = bottom.colors[0]?.toLowerCase();
  if (!topColor || !bottomColor) return 0.3;

  const isLiked = liked.some(
    (c) => c.topColor.toLowerCase() === topColor && c.bottomColor.toLowerCase() === bottomColor,
  );
  let score = isLiked ? 1.0 : 0.3;

  // Bonus if outerwear also harmonizes
  if (outerwear && outerwear.colors[0]) {
    const owColor = outerwear.colors[0].toLowerCase();
    const owTopMatch = liked.some(
      (c) => c.topColor.toLowerCase() === owColor && c.bottomColor.toLowerCase() === topColor,
    );
    if (owTopMatch) score = Math.min(1, score + 0.15);
  }

  return score;
}

function weatherScore(
  top: ClothingItem,
  bottom: ClothingItem,
  outerwear: ClothingItem | null,
  weather: TemperatureCategory | null,
): number {
  if (!weather) return 0.5;

  let score = 0.5;
  const items = [top, bottom, outerwear].filter(Boolean) as ClothingItem[];

  for (const item of items) {
    if (!isClothingAppropriateForWeather(item.type, weather)) return 0; // hard filter
    if (isClothingSuggestedForWeather(item.type, weather)) score += 0.15;
  }

  // Outerwear bonus/penalty
  if (isOuterwearRequired(weather) && !outerwear) score -= 0.3;
  if (isOuterwearSuggested(weather) && outerwear) score += 0.1;
  if (weather === 'hot' && outerwear) score -= 0.2;

  return Math.max(0, Math.min(1, score));
}

function varietyScore(
  top: ClothingItem,
  bottom: ClothingItem,
  shoes: ClothingItem,
  outerwear: ClothingItem | null,
  recentWears: OutfitWear[],
): number {
  if (recentWears.length === 0) return 0.5;

  const itemIds = [top.id, bottom.id, shoes.id, outerwear?.id].filter(Boolean) as string[];
  const recentIds = new Set<string>();
  recentWears.forEach((w) => {
    if (w.top_id) recentIds.add(w.top_id);
    if (w.bottom_id) recentIds.add(w.bottom_id);
    if (w.shoes_id) recentIds.add(w.shoes_id);
    if (w.outerwear_id) recentIds.add(w.outerwear_id);
  });

  const overlap = itemIds.filter((id) => recentIds.has(id)).length;
  return Math.max(0, 1 - overlap * 0.25);
}

function occasionScore(
  top: ClothingItem,
  bottom: ClothingItem,
  outerwear: ClothingItem | null,
  occasion: Occasion | null,
): number {
  if (!occasion) return 0.5;

  const rules = occasionRules[occasion];
  let score = 0;
  let count = 0;

  const topSection = typeToSection[top.type];
  if (topSection === 'Tops' && rules.tops.includes(top.type)) score += 1;
  count++;

  if (rules.bottoms.includes(bottom.type)) score += 1;
  count++;

  if (outerwear) {
    if (rules.outerwear.includes(outerwear.type)) score += 1;
    count++;
  }

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
  outerwear: ClothingItem | null,
  bottom: ClothingItem,
  shoes: ClothingItem,
  ctx: ScoringContext,
): number {
  const ch = colorHarmonyScore(top, bottom, outerwear, ctx.likedCombinations) * WEIGHT.COLOR_HARMONY;
  const ws = weatherScore(top, bottom, outerwear, ctx.weather) * WEIGHT.WEATHER;
  const vs = varietyScore(top, bottom, shoes, outerwear, ctx.recentWears) * WEIGHT.VARIETY;
  const os = occasionScore(top, bottom, outerwear, ctx.occasion) * WEIGHT.OCCASION;
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
  const outerwearItems = items.filter((i) => typeToSection[i.type] === 'Outerwear');
  const bottoms = items.filter((i) => typeToSection[i.type] === 'Bottoms');
  const shoesItems = items.filter((i) => typeToSection[i.type] === 'Shoes');

  if (tops.length === 0 || bottoms.length === 0 || shoesItems.length === 0) return [];

  const candidates: OutfitCandidate[] = [];

  // Enumerate up to ~500 random combos (fast enough for closet-sized wardrobes)
  const maxCombos = Math.min(
    tops.length * bottoms.length * shoesItems.length * (outerwearItems.length + 1),
    500,
  );

  const seen = new Set<string>();

  for (let i = 0; i < maxCombos * 3 && candidates.length < maxCombos; i++) {
    const top = tops[Math.floor(Math.random() * tops.length)];
    const bottom = bottoms[Math.floor(Math.random() * bottoms.length)];
    const shoes = shoesItems[Math.floor(Math.random() * shoesItems.length)];

    // Decide outerwear: include ~40% of the time (if items exist)
    const includeOuterwear =
      outerwearItems.length > 0 &&
      (ctx.weather === 'cold' || ctx.weather === 'cool' || Math.random() < 0.4);
    const outerwear = includeOuterwear
      ? outerwearItems[Math.floor(Math.random() * outerwearItems.length)]
      : null;

    const key = `${top.id}-${outerwear?.id ?? 'none'}-${bottom.id}-${shoes.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const score = scoreOutfit(top, outerwear, bottom, shoes, ctx);
    if (score > 0) {
      candidates.push({ top, outerwear, bottom, shoes, score });
    }
  }

  // Sort by score descending, return top N
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, count);
}
