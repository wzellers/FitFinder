// What goes in a user's daily email: one outfit for today's forecast, or the
// outfit the user already logged for today.
//
// The outfit uses the same candidates and learned weights as the Outfits tab,
// but always exploits: an email can't be re-rolled, so it sends the model's
// single best guess rather than an exploratory pick.

import { buildCandidates } from '@/lib/outfitScoring';
import type { OccasionRules } from '@/lib/outfitScoring';
import { deserializeModel, predict } from '@/lib/banditModel';
import type { SerializedModel } from '@/lib/banditModel';
import { getTemperatureCategory } from '@/lib/weatherApi';
import type { TemperatureCategory } from '@/lib/weatherApi';
import type { ClothingItem, ClothingWeatherRules, ColorCombination, OutfitWear } from '@/lib/types';

export interface DailyForecast {
  /** Today's high and low, °F. */
  high: number;
  low: number;
  /** Highest chance of precipitation today, 0–1. */
  rainChance: number;
  /** e.g. "Rain", "Clouds". */
  condition: string;
  /** e.g. "light rain". */
  description: string;
}

export interface Outfit {
  top: ClothingItem;
  bottom: ClothingItem;
  shoes: ClothingItem;
}

export interface DigestInput {
  items: ClothingItem[];
  /** Wears from at least the last 7 days, and today's (older rows are ignored). */
  recentWears: OutfitWear[];
  ratedOutfits: OutfitWear[];
  likedCombinations: ColorCombination[];
  model: Partial<SerializedModel> | null;
  forecast: DailyForecast | null;
  thresholds?: { cold: number; cool: number; warm: number } | null;
  weatherRules?: Record<string, ClothingWeatherRules> | null;
  occasionRules?: OccasionRules | null;
  /** The email's local date, `YYYY-MM-DD`. */
  today: string;
}

export interface Digest {
  outfit: Outfit | null;
  /** True when the outfit is the one the user logged for today, not a pick. */
  logged: boolean;
  temperature: TemperatureCategory | null;
}

/** The model's top outfit for today, or null if the closet can't make one. */
export function pickDailyOutfit(input: DigestInput, temperature: TemperatureCategory | null) {
  const clean = input.items.filter((i) => !i.is_dirty);
  const candidates = buildCandidates(clean, {
    likedCombinations: input.likedCombinations,
    weather: temperature,
    weatherRules: input.weatherRules ?? undefined,
    recentWears: input.recentWears,
    ratedOutfits: input.ratedOutfits,
    occasion: null,
    occasionRules: input.occasionRules ?? undefined,
  });
  const { params } = deserializeModel(input.model);
  let best: Outfit | null = null;
  let bestScore = -Infinity;
  let bestTie = Infinity;
  // Equal scores are common (no color preferences, nothing rated yet), so ties
  // go to a different outfit each day rather than always the first in the
  // closet; the same day always gives the same pick.
  for (const c of candidates) {
    const score = predict(params, c.features);
    const tie = hashString(`${input.today}|${c.top.id}|${c.bottom.id}|${c.shoes.id}`);
    if (score > bestScore || (score === bestScore && tie < bestTie)) {
      bestScore = score;
      bestTie = tie;
      best = { top: c.top, bottom: c.bottom, shoes: c.shoes };
    }
  }
  return best;
}

/** FNV-1a: a fast, stable 32-bit hash. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The outfit logged for today, if all three of its pieces are still in the
 * closet. The latest log wins; it's sent even if a piece is in the wash or
 * off for the weather, since that's what the user chose.
 */
export function loggedOutfit(input: DigestInput): Outfit | null {
  const byId = new Map(input.items.map((i) => [i.id, i]));
  const today = input.recentWears
    .filter((w) => w.worn_date === input.today)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  for (const w of today) {
    const top = w.top_id ? byId.get(w.top_id) : undefined;
    const bottom = w.bottom_id ? byId.get(w.bottom_id) : undefined;
    const shoes = w.shoes_id ? byId.get(w.shoes_id) : undefined;
    if (top && bottom && shoes) return { top, bottom, shoes };
  }
  return null;
}

export function buildDigest(input: DigestInput): Digest {
  const temperature = input.forecast
    ? getTemperatureCategory(input.forecast.high, input.thresholds ?? undefined)
    : null;
  const logged = loggedOutfit(input);
  if (logged) return { outfit: logged, logged: true, temperature };
  return { outfit: pickDailyOutfit(input, temperature), logged: false, temperature };
}
