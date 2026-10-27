// Outfit generation: filter by weather and occasion, then score candidates.
//
// Weather and occasion are hard filters only: an item is either allowed or
// not, and they play no part in ranking. Ranking uses three features (color,
// variety, rating), each in [0, 1]. Their fixed weights sum to 1.0 and are the
// cold-start prior of the learned model in banditModel.ts.

import type { ClothingItem, ColorCombination, OutfitWear } from '@/lib/types';
import type { TemperatureCategory } from '@/lib/weatherApi';
import { typeToSection, occasionRules as defaultOccasionRules } from '@/lib/constants';
import type { Occasion } from '@/lib/constants';
import { getUserClothingWeatherRules } from '@/lib/weatherApi';
import type { ClothingWeatherRules } from '@/lib/types';

// ============================================================================
// TYPES
// ============================================================================

interface OutfitCandidate {
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
  /** Score as of this date (YYYY-MM-DD) instead of now, e.g. for a past day's
   * wear. Only affects how recent `recentWears` count as. */
  asOf?: string;
  /** Each item's rating estimate in [0, 1], replacing the mean from
   * `ratedOutfits`; e.g. `sampleItemRatings` to explore untried items. */
  itemRating?: (itemId: string) => number;
}

// ============================================================================
// FEATURE WEIGHTS (cold-start priors; sum to 1.0)
// ============================================================================

// Rating-heavy: in the benchmark's cold-start sweep this was best or tied in
// every scenario, mostly in the first weeks (docs/BANDIT_BENCHMARK.md).
export const FEATURE_WEIGHTS = {
  color: 0.25,
  variety: 0.25,
  rating: 0.5,
} as const;

// Number of recent days over which repetition is penalized.
const RECENCY_WINDOW_DAYS = 14;

// ============================================================================
// HELPERS
// ============================================================================

function pairMatchesLiked(
  topColor: string,
  bottomColor: string,
  liked: ColorCombination[],
): boolean {
  return liked.some(
    (c) =>
      (c.topColor.toLowerCase() === topColor && c.bottomColor.toLowerCase() === bottomColor) ||
      (c.topColor.toLowerCase() === bottomColor && c.bottomColor.toLowerCase() === topColor),
  );
}

function daysSince(dateStr: string, asOf?: string): number {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return Infinity;
  const now = asOf ? new Date(asOf).getTime() : Date.now();
  return (now - then) / (1000 * 60 * 60 * 24);
}

// ============================================================================
// FEATURE FUNCTIONS — each returns a value in [0, 1]
// ============================================================================

/** Color harmony: 1 if the top/bottom colors form a liked combination. */
function colorFeature(top: ClothingItem, bottom: ClothingItem, liked: ColorCombination[]): number {
  if (liked.length === 0) return 0.5; // neutral when the user has no preferences
  const tc = top.colors[0]?.toLowerCase();
  const bc = bottom.colors[0]?.toLowerCase();
  if (!tc || !bc) return 0.5;
  return pairMatchesLiked(tc, bc, liked) ? 1 : 0.25;
}

/**
 * Variety: 1 when none of the items were worn recently; lower as items appear
 * in more recent wears (linear decay over RECENCY_WINDOW_DAYS).
 */
function varietyFeature(
  outfit: { top: ClothingItem; bottom: ClothingItem; shoes: ClothingItem },
  recentWears: OutfitWear[],
  asOf?: string,
): number {
  if (recentWears.length === 0) return 1;
  const ids = new Set([outfit.top.id, outfit.bottom.id, outfit.shoes.id]);
  let penalty = 0;
  for (const w of recentWears) {
    const age = daysSince(w.worn_date, asOf);
    if (age < 0 || age > RECENCY_WINDOW_DAYS) continue;
    const recencyWeight = 1 - age / RECENCY_WINDOW_DAYS; // 1 (today) → 0 (window edge)
    const overlap = [w.top_id, w.bottom_id, w.shoes_id].filter((id) => id && ids.has(id)).length;
    penalty += (overlap / 3) * recencyWeight;
  }
  return Math.max(0, 1 - penalty);
}

// What an item's rating is believed to be before any rating (neutral), and how
// many ratings that belief counts as.
const ITEM_RATING_PRIOR = 0.5;
const ITEM_PRIOR_COUNT = 1;
/** How widely an unrated item's rating is drawn when picking (narrowing with
 * each rating). 0.1 did best in the benchmark's sweep; 0.25 explored so much
 * that typical users got worse picks. */
export const ITEM_RATING_SPREAD = 0.1;

/** Sum and count of normalized ratings per item, from rated outfits. */
function itemRatingTotals(ratedOutfits: OutfitWear[]): Map<string, { sum: number; n: number }> {
  const totals = new Map<string, { sum: number; n: number }>();
  for (const w of ratedOutfits) {
    if (typeof w.rating !== 'number') continue;
    for (const id of [w.top_id, w.bottom_id, w.shoes_id]) {
      if (!id) continue;
      const t = totals.get(id) ?? { sum: 0, n: 0 };
      t.sum += w.rating / 10; // ratings are 1–10 → [0.1, 1]
      t.n += 1;
      totals.set(id, t);
    }
  }
  return totals;
}

function itemEstimate(t: { sum: number; n: number } | undefined, spread = ITEM_RATING_SPREAD) {
  const n = ITEM_PRIOR_COUNT + (t?.n ?? 0);
  return {
    mean: (ITEM_RATING_PRIOR * ITEM_PRIOR_COUNT + (t?.sum ?? 0)) / n,
    sd: spread / Math.sqrt(n),
  };
}

/** Each item's expected rating: its ratings averaged with a neutral prior. */
export function meanItemRatings(ratedOutfits: OutfitWear[]): (itemId: string) => number {
  const totals = itemRatingTotals(ratedOutfits);
  return (id) => itemEstimate(totals.get(id)).mean;
}

/**
 * One random draw of every item's rating, from how sure we are of it: items
 * with few ratings vary most, so untried pieces sometimes rank high and get
 * shown (Thompson sampling over items). Draws are fixed per item per call.
 */
export function sampleItemRatings(
  ratedOutfits: OutfitWear[],
  rng: () => number = Math.random,
  spread = ITEM_RATING_SPREAD,
): (itemId: string) => number {
  const totals = itemRatingTotals(ratedOutfits);
  const drawn = new Map<string, number>();
  return (id) => {
    let v = drawn.get(id);
    if (v === undefined) {
      const { mean, sd } = itemEstimate(totals.get(id), spread);
      v = Math.min(1, Math.max(0, mean + sd * standardNormal(rng)));
      drawn.set(id, v);
    }
    return v;
  };
}

function standardNormal(rng: () => number): number {
  const u = Math.max(rng(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/**
 * Rating affinity: the average of the outfit's three items' rating estimates.
 * An item no one has rated counts as neutral (0.5), so one good rating lifts
 * its own pieces without crowding out the rest of the closet.
 */
function ratingFeature(
  outfit: { top: ClothingItem; bottom: ClothingItem; shoes: ClothingItem },
  itemRating: (itemId: string) => number,
): number {
  return (
    (itemRating(outfit.top.id) + itemRating(outfit.bottom.id) + itemRating(outfit.shoes.id)) / 3
  );
}

// ============================================================================
// FEATURE VECTOR
// ============================================================================

/** Ordered feature names — the index order of `featureVector`. */
export const FEATURE_NAMES = ['color', 'variety', 'rating'] as const;
export type FeatureName = (typeof FEATURE_NAMES)[number];

/**
 * The ranking features as a vector, in `FEATURE_NAMES` order. This is the
 * single source of truth for featurization, shared by the fixed-weight scorer
 * (below) and the learned bandit model (`banditModel.ts`). Weather and occasion
 * are not features: `buildCandidates` filters by them before this runs.
 */
export function featureVector(
  outfit: {
    top: ClothingItem;
    bottom: ClothingItem;
    shoes: ClothingItem;
  },
  ctx: Pick<
    ScoringContext,
    'likedCombinations' | 'recentWears' | 'ratedOutfits' | 'asOf' | 'itemRating'
  >,
): Record<FeatureName, number> {
  return {
    color: colorFeature(outfit.top, outfit.bottom, ctx.likedCombinations),
    variety: varietyFeature(outfit, ctx.recentWears ?? [], ctx.asOf),
    rating: ratingFeature(outfit, ctx.itemRating ?? meanItemRatings(ctx.ratedOutfits ?? [])),
  };
}

// ============================================================================
// GENERATION
// ============================================================================

/** An outfit candidate paired with its feature vector (before scoring). */
interface FeaturizedCandidate {
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

  // Occasion filter — hard-constrain each slot to the types valid for the
  // selected occasion, so a generated outfit always matches it. No-op when no
  // occasion is selected (the "Any" case).
  const occasionRules: OccasionRules = { ...defaultOccasionRules, ...(ctx.occasionRules ?? {}) };
  if (ctx.occasion) {
    const rule = occasionRules[ctx.occasion];
    if (rule) {
      tops = tops.filter((i) => rule.tops.includes(i.type));
      bottoms = bottoms.filter((i) => rule.bottoms.includes(i.type));
      shoesItems = shoesItems.filter((i) => rule.shoes.includes(i.type));
      if (tops.length === 0 || bottoms.length === 0 || shoesItems.length === 0) return [];
    }
  }

  // Item ratings once for all candidates (and the same draw, when sampled).
  const featureCtx = {
    ...ctx,
    itemRating: ctx.itemRating ?? meanItemRatings(ctx.ratedOutfits ?? []),
  };
  const candidates: FeaturizedCandidate[] = [];
  const seen = new Set<string>();
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoes of shoesItems) {
        const key = `${top.id}-${bottom.id}-${shoes.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const outfit = { top, bottom, shoes };
        candidates.push({ ...outfit, features: featureVector(outfit, featureCtx) });
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
    score:
      FEATURE_WEIGHTS.color * c.features.color +
      FEATURE_WEIGHTS.variety * c.features.variety +
      FEATURE_WEIGHTS.rating * c.features.rating,
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
