// Outfit generation — filter by weather, then score candidates with a
// fixed-weight linear model and return them sorted by score (descending).
//
// The five feature components below double as the contextual-bandit feature
// functions (Workstream B): their fixed weights are the cold-start priors that
// a learned model will later replace. Each component returns a value in [0, 1]
// and the weights sum to 1.0, so an outfit's score is also in [0, 1].

import type { ClothingItem, ColorCombination, OutfitWear } from '@/lib/types';
import type { TemperatureCategory } from '@/lib/weatherApi';
import { typeToSection, occasionRules as defaultOccasionRules } from '@/lib/constants';
import type { Occasion } from '@/lib/constants';
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

export type OccasionRules = Record<string, { tops: string[]; bottoms: string[]; shoes: string[] }>;

export interface ScoringContext {
  /** Liked top/bottom color combinations (seeds the color feature). */
  likedCombinations: ColorCombination[];
  /** Current temperature category, or null to ignore weather. */
  weather: TemperatureCategory | null;
  /** Per-type weather rule overrides merged over the defaults. */
  weatherRules?: Record<string, ClothingWeatherRules>;
  /** Recent wear history — used to down-weight repetition. */
  recentWears?: OutfitWear[];
  /** Target occasion, or null for no occasion preference. */
  occasion?: Occasion | string | null;
  /** Per-occasion type rule overrides merged over the defaults. */
  occasionRules?: OccasionRules;
  /** Past wears that carry an explicit rating — boosts similar outfits. */
  ratedOutfits?: OutfitWear[];
}

// ============================================================================
// FEATURE WEIGHTS (cold-start priors; sum to 1.0)
// ============================================================================

export const FEATURE_WEIGHTS = {
  color: 0.30,
  weather: 0.25,
  variety: 0.20,
  occasion: 0.15,
  rating: 0.10,
} as const;

// Number of recent days over which repetition is penalized.
const RECENCY_WINDOW_DAYS = 14;

// ============================================================================
// HELPERS
// ============================================================================

function pairMatchesLiked(topColor: string, bottomColor: string, liked: ColorCombination[]): boolean {
  return liked.some(
    (c) =>
      (c.topColor.toLowerCase() === topColor && c.bottomColor.toLowerCase() === bottomColor) ||
      (c.topColor.toLowerCase() === bottomColor && c.bottomColor.toLowerCase() === topColor),
  );
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return Infinity;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

// ============================================================================
// FEATURE FUNCTIONS — each returns a value in [0, 1]
// ============================================================================

/** Color harmony: 1 if the top/bottom colors form a liked combination. */
export function colorFeature(top: ClothingItem, bottom: ClothingItem, liked: ColorCombination[]): number {
  if (liked.length === 0) return 0.5; // neutral when the user has no preferences
  const tc = top.colors[0]?.toLowerCase();
  const bc = bottom.colors[0]?.toLowerCase();
  if (!tc || !bc) return 0.5;
  return pairMatchesLiked(tc, bc, liked) ? 1 : 0.25;
}

/**
 * Weather appropriateness: averages each item's fit for the current category.
 * suggestedIn → 1, neither suggested nor blocked → 0.5 (blocked items are
 * filtered out before scoring, so they never reach here).
 */
export function weatherFeature(
  outfit: { top: ClothingItem; bottom: ClothingItem; shoes: ClothingItem },
  weather: TemperatureCategory | null,
  rules: Record<string, ClothingWeatherRules>,
): number {
  if (!weather) return 0.5; // neutral, still positive, when weather is ignored
  const fit = (item: ClothingItem): number => {
    const r = rules[item.type];
    if (!r) return 0.5;
    if (r.suggestedIn.includes(weather)) return 1;
    if (r.blockedIn.includes(weather)) return 0; // defensive; normally pre-filtered
    return 0.5;
  };
  return (fit(outfit.top) + fit(outfit.bottom) + fit(outfit.shoes)) / 3;
}

/**
 * Variety: 1 when none of the items were worn recently; lower as items appear
 * in more recent wears (linear decay over RECENCY_WINDOW_DAYS).
 */
export function varietyFeature(
  outfit: { top: ClothingItem; bottom: ClothingItem; shoes: ClothingItem },
  recentWears: OutfitWear[],
): number {
  if (recentWears.length === 0) return 1;
  const ids = new Set([outfit.top.id, outfit.bottom.id, outfit.shoes.id]);
  let penalty = 0;
  for (const w of recentWears) {
    const age = daysSince(w.worn_date);
    if (age > RECENCY_WINDOW_DAYS) continue;
    const recencyWeight = 1 - age / RECENCY_WINDOW_DAYS; // 1 (today) → 0 (window edge)
    const overlap = [w.top_id, w.bottom_id, w.shoes_id].filter((id) => id && ids.has(id)).length;
    penalty += (overlap / 3) * recencyWeight;
  }
  return Math.max(0, 1 - penalty);
}

/**
 * Occasion fit: averages whether each item's type is allowed for the occasion.
 * Returns neutral 0.5 when no occasion is set or the occasion is unknown.
 */
export function occasionFeature(
  outfit: { top: ClothingItem; bottom: ClothingItem; shoes: ClothingItem },
  occasion: string | null | undefined,
  rules: OccasionRules,
): number {
  if (!occasion) return 0.5;
  const rule = rules[occasion];
  if (!rule) return 0.5;
  const score = (allowed: string[], item: ClothingItem) => (allowed.includes(item.type) ? 1 : 0);
  return (
    (score(rule.tops, outfit.top) + score(rule.bottoms, outfit.bottom) + score(rule.shoes, outfit.shoes)) / 3
  );
}

/**
 * Rating affinity: blends the normalized ratings of past wears that share items
 * with this outfit, weighted by how many items overlap. Neutral 0.5 with no data.
 */
export function ratingFeature(
  outfit: { top: ClothingItem; bottom: ClothingItem; shoes: ClothingItem },
  ratedOutfits: OutfitWear[],
): number {
  const ids = new Set([outfit.top.id, outfit.bottom.id, outfit.shoes.id]);
  let weightedSum = 0;
  let weightTotal = 0;
  for (const w of ratedOutfits) {
    if (typeof w.rating !== 'number') continue;
    const overlap = [w.top_id, w.bottom_id, w.shoes_id].filter((id) => id && ids.has(id)).length;
    if (overlap === 0) continue;
    const weight = overlap / 3;
    weightedSum += (w.rating / 10) * weight; // ratings are 1–10 → [0.1, 1]
    weightTotal += weight;
  }
  if (weightTotal === 0) return 0.5; // neutral when no rated outfit shares items
  return weightedSum / weightTotal;
}

// ============================================================================
// FEATURE VECTOR + SCORING
// ============================================================================

/** Ordered feature names — the index order of `featureVector`. */
export const FEATURE_NAMES = ['color', 'weather', 'variety', 'occasion', 'rating'] as const;
export type FeatureName = (typeof FEATURE_NAMES)[number];

/**
 * The five feature components as a vector, in `FEATURE_NAMES` order. This is the
 * single source of truth for featurization, shared by the fixed-weight scorer
 * (below) and the learned bandit model (`banditModel.ts`).
 */
export function featureVector(
  outfit: { top: ClothingItem; bottom: ClothingItem; shoes: ClothingItem },
  ctx: ScoringContext,
  rules: Record<string, ClothingWeatherRules>,
  occasionRules: OccasionRules,
): Record<FeatureName, number> {
  return {
    color: colorFeature(outfit.top, outfit.bottom, ctx.likedCombinations),
    weather: weatherFeature(outfit, ctx.weather, rules),
    variety: varietyFeature(outfit, ctx.recentWears ?? []),
    occasion: occasionFeature(outfit, ctx.occasion, occasionRules),
    rating: ratingFeature(outfit, ctx.ratedOutfits ?? []),
  };
}

/** Linear combination of the five feature components; result in [0, 1]. */
export function scoreOutfit(
  outfit: { top: ClothingItem; bottom: ClothingItem; shoes: ClothingItem },
  ctx: ScoringContext,
  rules: Record<string, ClothingWeatherRules>,
  occasionRules: OccasionRules,
): number {
  const f = featureVector(outfit, ctx, rules, occasionRules);
  return (
    FEATURE_WEIGHTS.color * f.color +
    FEATURE_WEIGHTS.weather * f.weather +
    FEATURE_WEIGHTS.variety * f.variety +
    FEATURE_WEIGHTS.occasion * f.occasion +
    FEATURE_WEIGHTS.rating * f.rating
  );
}

// ============================================================================
// GENERATION
// ============================================================================

/** An outfit candidate paired with its feature vector (before scoring). */
export interface FeaturizedCandidate {
  top: ClothingItem;
  bottom: ClothingItem;
  shoes: ClothingItem;
  features: Record<FeatureName, number>;
}

/**
 * Categorize, weather-filter, and featurize every valid top×bottom×shoes outfit.
 * This is the shared front half of generation: the deterministic scorer and the
 * learned bandit both consume these featurized candidates (the bandit scores them
 * with learned weights via `selectOutfits`).
 */
export function buildCandidates(items: ClothingItem[], ctx: ScoringContext): FeaturizedCandidate[] {
  let tops = items.filter((i) => typeToSection[i.type] === 'Tops');
  let bottoms = items.filter((i) => typeToSection[i.type] === 'Bottoms');
  let shoesItems = items.filter((i) => typeToSection[i.type] === 'Shoes');

  if (tops.length === 0 || bottoms.length === 0 || shoesItems.length === 0) return [];

  // Weather filter — remove blocked items.
  const rules = getUserClothingWeatherRules(ctx.weatherRules);
  if (ctx.weather) {
    const notBlocked = (i: ClothingItem) => {
      const r = rules[i.type];
      return !r || !r.blockedIn.includes(ctx.weather!);
    };
    tops = tops.filter(notBlocked);
    bottoms = bottoms.filter(notBlocked);
    shoesItems = shoesItems.filter(notBlocked);
  }

  if (tops.length === 0 || bottoms.length === 0 || shoesItems.length === 0) return [];

  const occasionRules: OccasionRules = { ...defaultOccasionRules, ...(ctx.occasionRules ?? {}) };

  const candidates: FeaturizedCandidate[] = [];
  const seen = new Set<string>();
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoes of shoesItems) {
        const key = `${top.id}-${bottom.id}-${shoes.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const outfit = { top, bottom, shoes };
        candidates.push({ ...outfit, features: featureVector(outfit, ctx, rules, occasionRules) });
      }
    }
  }
  return candidates;
}

export function generateScoredOutfits(
  items: ClothingItem[],
  ctx: ScoringContext,
  count: number = 5,
): OutfitCandidate[] {
  const candidates: OutfitCandidate[] = buildCandidates(items, ctx).map((c) => ({
    top: c.top,
    bottom: c.bottom,
    shoes: c.shoes,
    score: (
      FEATURE_WEIGHTS.color * c.features.color +
      FEATURE_WEIGHTS.weather * c.features.weather +
      FEATURE_WEIGHTS.variety * c.features.variety +
      FEATURE_WEIGHTS.occasion * c.features.occasion +
      FEATURE_WEIGHTS.rating * c.features.rating
    ),
  }));

  // Sort by score (descending) and return the top `count`. Ties are broken by a
  // small random jitter so repeated calls vary among equally-scored outfits
  // without disturbing the ranking of distinct scores.
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return Math.random() - 0.5;
  });

  return candidates.slice(0, count);
}
