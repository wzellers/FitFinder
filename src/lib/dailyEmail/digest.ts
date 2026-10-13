// What goes in a user's daily email: one outfit for today's forecast, and the
// clean items they haven't worn yet this week.
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
import { typeToSection } from '@/lib/constants';
import { shiftDate } from '@/lib/dailyEmail/schedule';
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
  /** Wears from at least the last 7 days (older rows are ignored). */
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
  temperature: TemperatureCategory | null;
  /** Clean items not worn in the last 7 days, outfit items excluded. */
  unworn: ClothingItem[];
  /** Total clean items not worn this week, before the display limit. */
  unwornCount: number;
}

/** Items shown in the "not worn this week" row. */
export const UNWORN_LIMIT = 6;

/** Ids of items worn in the 7 days ending `today` (inclusive). */
export function wornThisWeek(wears: OutfitWear[], today: string): Set<string> {
  const from = shiftDate(today, -6);
  const ids = new Set<string>();
  for (const w of wears) {
    if (w.worn_date < from || w.worn_date > today) continue;
    for (const id of [w.top_id, w.bottom_id, w.shoes_id]) if (id) ids.add(id);
  }
  return ids;
}

const SECTION_ORDER: Record<string, number> = { Tops: 0, Bottoms: 1, Shoes: 2 };

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
  // Strict ">" keeps the first of equal scores, so the pick is deterministic.
  for (const c of candidates) {
    const score = predict(params, c.features);
    if (score > bestScore) {
      bestScore = score;
      best = { top: c.top, bottom: c.bottom, shoes: c.shoes };
    }
  }
  return best;
}

export function buildDigest(input: DigestInput): Digest {
  const temperature = input.forecast
    ? getTemperatureCategory(input.forecast.high, input.thresholds ?? undefined)
    : null;
  const outfit = pickDailyOutfit(input, temperature);

  const worn = wornThisWeek(input.recentWears, input.today);
  const inOutfit = new Set(outfit ? [outfit.top.id, outfit.bottom.id, outfit.shoes.id] : []);
  const unwornAll = input.items.filter((i) => !i.is_dirty && !worn.has(i.id));
  const unworn = unwornAll
    .filter((i) => !inOutfit.has(i.id))
    // The longest-owned pieces first, then shown as tops, bottoms, shoes.
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    .slice(0, UNWORN_LIMIT)
    .sort(
      (a, b) =>
        (SECTION_ORDER[typeToSection[a.type]] ?? 3) - (SECTION_ORDER[typeToSection[b.type]] ?? 3),
    );

  return { outfit, temperature, unworn, unwornCount: unwornAll.length };
}
