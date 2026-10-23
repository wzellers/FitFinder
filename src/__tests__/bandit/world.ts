// The simulated world for the bandit benchmark: closets, days and users.
//
// Everything the learner sees is produced by the app's real code
// (`buildCandidates` → `featureVector`), from realistic closets, weather and
// occasions. Only the user is synthetic: a hidden taste the learner has to
// discover from noisy 1–10 ratings.

import { buildCandidates, FEATURE_NAMES, type ScoringContext } from '@/lib/outfitScoring';
import { getTemperatureCategory, type TemperatureCategory } from '@/lib/weatherApi';
import type { ClothingItem, ColorCombination, OutfitWear } from '@/lib/types';
import type { FeatureVector } from '@/lib/banditModel';

// ---------------------------------------------------------------------------
// Randomness
// ---------------------------------------------------------------------------

export type Rng = () => number;

/** Deterministic PRNG (mulberry32), so every run is reproducible. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample (Box–Muller). */
export function gaussian(rng: Rng): number {
  const u = Math.max(rng(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const intBetween = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

// ---------------------------------------------------------------------------
// Closets
// ---------------------------------------------------------------------------

const TOP_TYPES = [
  'T-Shirt',
  'T-Shirt',
  'Long Sleeve Shirt',
  'Polo',
  'Tank Top',
  'Button-Up Shirt',
  'Jacket',
  'Sweatshirt',
  'Crewneck',
  'Sweater',
] as const;
const BOTTOM_TYPES = ['Jeans', 'Jeans', 'Pants', 'Shorts', 'Sweats', 'Leggings', 'Skirt'] as const;
// Neutrals are commoner in real closets.
const COLORS = [
  'black',
  'black',
  'white',
  'white',
  'gray',
  'gray',
  'navy blue',
  'navy blue',
  'beige',
  'denim',
  'blue',
  'light blue',
  'brown',
  'dark green',
  'red',
  'pink',
  'yellow',
  'purple',
  'orange',
  'light green',
] as const;

function item(rng: Rng, id: string, type: string): ClothingItem {
  const colors = [type === 'Jeans' && rng() < 0.7 ? 'denim' : pick(rng, COLORS)];
  return { id, type, colors, image_url: '', is_dirty: false };
}

/**
 * A closet of 6–14 tops, 4–8 bottoms and 2–4 shoes. Always has at least one
 * top and bottom that work in any weather and for Work, so every day has
 * candidates.
 */
export function makeCloset(rng: Rng): ClothingItem[] {
  const items: ClothingItem[] = [
    item(rng, 't0', 'Long Sleeve Shirt'),
    item(rng, 'b0', 'Pants'),
    item(rng, 's0', 'Shoes'),
  ];
  for (let i = 1; i < intBetween(rng, 6, 14); i++)
    items.push(item(rng, `t${i}`, pick(rng, TOP_TYPES)));
  for (let i = 1; i < intBetween(rng, 4, 8); i++)
    items.push(item(rng, `b${i}`, pick(rng, BOTTOM_TYPES)));
  for (let i = 1; i < intBetween(rng, 2, 4); i++) items.push(item(rng, `s${i}`, 'Shoes'));
  return items;
}

// ---------------------------------------------------------------------------
// Days: weather and occasion
// ---------------------------------------------------------------------------

export interface Day {
  weather: TemperatureCategory;
  occasion: string | null;
}

/**
 * A run of days starting on a random day of the year. Daily highs follow a
 * temperate seasonal curve (≈35°F in January to ≈85°F in July) plus noise,
 * mapped to the app's own temperature categories.
 */
export function makeDays(rng: Rng, count: number): Day[] {
  const start = Math.floor(rng() * 365);
  const days: Day[] = [];
  for (let d = 0; d < count; d++) {
    const doy = (start + d) % 365;
    const temp = 60 - 25 * Math.cos((2 * Math.PI * (doy - 15)) / 365) + gaussian(rng) * 8;
    const r = rng();
    const occasion =
      r < 0.5 ? null : r < 0.8 ? 'Work' : r < 0.9 ? 'Casual' : r < 0.95 ? 'Date' : 'Active';
    days.push({ weather: getTemperatureCategory(temp), occasion });
  }
  return days;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** The features a real person has a taste for. Rating and occasion are not
 * tastes: rating is the app's proxy for liked items, and occasion is enforced by
 * filtering, so it is constant within a day. */
export const TASTE_FEATURES = ['color', 'weather', 'variety'] as const;
export type TasteFeature = (typeof TASTE_FEATURES)[number];

export interface UserProfile {
  /** Hidden weights over color, weather and variety. */
  taste: Record<TasteFeature, number>;
  /** Hidden per-item liking (most items near 0, a few clear favourites). */
  affinity: Map<string, number>;
  /** Standard deviation of rating noise, in reward units (1 rating point ≈ 0.11). */
  noise: number;
  /** Optional taste the user drifts to halfway through. */
  laterTaste?: Record<TasteFeature, number>;
}

export interface Population {
  name: string;
  description: string;
  makeUser: (rng: Rng, closet: ClothingItem[]) => UserProfile;
}

/** Taste weights from a flat Dirichlet, scaled so tastes explain about half
 * the spread in ratings and item affinities the rest. */
function randomTaste(rng: Rng, scale = 0.6): Record<TasteFeature, number> {
  const raw = TASTE_FEATURES.map(() => -Math.log(Math.max(rng(), 1e-12)));
  const total = raw.reduce((s, v) => s + v, 0);
  const t = {} as Record<TasteFeature, number>;
  TASTE_FEATURES.forEach((f, i) => (t[f] = (scale * raw[i]) / total));
  return t;
}

function randomAffinity(rng: Rng, closet: ClothingItem[], sd = 0.08) {
  return new Map(closet.map((i) => [i.id, gaussian(rng) * sd]));
}

export const POPULATIONS: Population[] = [
  {
    name: 'typical',
    description: 'Random tastes over color/weather/variety, item favourites, ±1-point rating noise',
    makeUser: (rng, closet) => ({
      taste: randomTaste(rng),
      affinity: randomAffinity(rng, closet),
      noise: 0.11,
    }),
  },
  {
    name: 'item-driven',
    description: 'Likes specific pieces far more than any general rule',
    makeUser: (rng, closet) => ({
      taste: randomTaste(rng, 0.25),
      affinity: randomAffinity(rng, closet, 0.18),
      noise: 0.11,
    }),
  },
  {
    name: 'noisy',
    description: 'Typical tastes, inconsistent ratings (±3 points)',
    makeUser: (rng, closet) => ({
      taste: randomTaste(rng),
      affinity: randomAffinity(rng, closet),
      noise: 0.33,
    }),
  },
  {
    name: 'drifting',
    description: 'Taste changes completely halfway through',
    makeUser: (rng, closet) => ({
      taste: randomTaste(rng),
      affinity: randomAffinity(rng, closet),
      noise: 0.11,
      laterTaste: randomTaste(rng),
    }),
  },
];

/** The user's true (noise-free) liking of an outfit on a given day. */
export function trueUtility(
  user: UserProfile,
  features: FeatureVector,
  outfit: { top: ClothingItem; bottom: ClothingItem; shoes: ClothingItem },
  drifted: boolean,
): number {
  const taste = drifted && user.laterTaste ? user.laterTaste : user.taste;
  let u = 0;
  for (const f of TASTE_FEATURES) u += taste[f] * features[f];
  for (const i of [outfit.top, outfit.bottom, outfit.shoes]) u += user.affinity.get(i.id) ?? 0;
  return u;
}

/** A 1–10 rating: true utility plus noise, rounded like a person would. */
export function rate(utility: number, noise: number, rng: Rng): number {
  // Utilities sit around 0.1–0.7; spread them over the 1–10 scale.
  const r = 1 + 9 * Math.min(1, Math.max(0, (utility - 0.05) / 0.7 + gaussian(rng) * noise));
  return Math.round(r);
}

// ---------------------------------------------------------------------------
// Building a day's candidates with the app's real code
// ---------------------------------------------------------------------------

export interface WearRecord {
  day: number;
  top: string;
  bottom: string;
  shoes: string;
  rating: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Convert the simulation's history into the app's OutfitWear rows, dated
 * relative to today so the variety window works as in the app. */
function toWears(history: WearRecord[], today: number, withRating: boolean): OutfitWear[] {
  return history.map((h, i) => ({
    id: `w${i}`,
    user_id: 'sim',
    top_id: h.top,
    bottom_id: h.bottom,
    shoes_id: h.shoes,
    worn_date: new Date(Date.now() - (today - h.day) * DAY_MS).toISOString().slice(0, 10),
    rating: withRating ? h.rating : undefined,
  }));
}

export function candidatesFor(
  closet: ClothingItem[],
  liked: ColorCombination[],
  day: Day,
  today: number,
  history: WearRecord[],
) {
  const recent = history.filter((h) => today - h.day <= 14);
  const ctx: ScoringContext = {
    likedCombinations: liked,
    weather: day.weather,
    occasion: day.occasion,
    recentWears: toWears(recent, today, false),
    ratedOutfits: toWears(history.slice(-100), today, true),
  };
  let cands = buildCandidates(closet, ctx);
  // An occasion the closet can't dress for falls back to "any", as a user would.
  if (cands.length === 0) cands = buildCandidates(closet, { ...ctx, occasion: null });
  return cands;
}

/** A few liked color pairs, chosen from colors actually in the closet. */
export function makeLikedCombos(rng: Rng, closet: ClothingItem[]): ColorCombination[] {
  const tops = closet.filter((i) => i.id.startsWith('t')).map((i) => i.colors[0]);
  const bottoms = closet.filter((i) => i.id.startsWith('b')).map((i) => i.colors[0]);
  const n = intBetween(rng, 0, 4);
  const out: ColorCombination[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ id: `c${i}`, topColor: pick(rng, tops), bottomColor: pick(rng, bottoms) });
  }
  return out;
}

export { FEATURE_NAMES };
