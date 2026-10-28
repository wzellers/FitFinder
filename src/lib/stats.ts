// Insights for the Stats screen, from the closet and the wear log. Pure, so
// they're easy to test.

import { typeToSection } from '@/lib/constants';
import type { ClothingItem, OutfitWear } from '@/lib/types';

type Wear = Pick<OutfitWear, 'worn_date' | 'top_id' | 'bottom_id' | 'shoes_id'>;

/** `YYYY-MM-DD` one day before `date`. */
function dayBefore(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Days in a row with an outfit logged, ending today (or yesterday, so a
 * streak isn't broken before today's outfit is logged).
 */
export function wearStreak(wears: Wear[], today: string): number {
  const days = new Set(wears.map((w) => w.worn_date));
  let day = days.has(today) ? today : dayBefore(today);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = dayBefore(day);
  }
  return streak;
}

/** Outfits logged on each weekday, Sunday first. */
export function weekdayCounts(wears: Wear[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const w of wears) counts[new Date(`${w.worn_date}T00:00:00Z`).getUTCDay()] += 1;
  return counts;
}

export interface Pairing {
  top: string;
  bottom: string;
  count: number;
}

/** The top and bottom main-colour pairing worn most often. */
export function favoritePairing(wears: Wear[], items: ClothingItem[]): Pairing | null {
  const byId = new Map(items.map((i) => [i.id, i]));
  const counts = new Map<string, Pairing>();
  for (const w of wears) {
    const top = byId.get(w.top_id ?? '')?.colors[0];
    const bottom = byId.get(w.bottom_id ?? '')?.colors[0];
    if (!top || !bottom) continue;
    const key = `${top}|${bottom}`;
    const entry = counts.get(key) ?? { top, bottom, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  let best: Pairing | null = null;
  for (const p of counts.values()) if (!best || p.count > best.count) best = p;
  return best;
}

export interface CategoryUse {
  section: 'Tops' | 'Bottoms' | 'Shoes';
  worn: number;
  total: number;
}

/** How many of each category's pieces were worn at least once. */
export function categoryUse(items: ClothingItem[], wears: Wear[]): CategoryUse[] {
  const worn = new Set(wears.flatMap((w) => [w.top_id, w.bottom_id, w.shoes_id]));
  return (['Tops', 'Bottoms', 'Shoes'] as const).map((section) => {
    const inSection = items.filter((i) => typeToSection[i.type] === section);
    return {
      section,
      total: inSection.length,
      worn: inSection.filter((i) => worn.has(i.id)).length,
    };
  });
}

/** Share of logged outfits (0–1) that repeat an exact earlier outfit. */
export function rewearRate(wears: Wear[]): number {
  if (wears.length === 0) return 0;
  const seen = new Set<string>();
  let repeats = 0;
  for (const w of [...wears].sort((a, b) => a.worn_date.localeCompare(b.worn_date))) {
    const key = `${w.top_id}|${w.bottom_id}|${w.shoes_id}`;
    if (seen.has(key)) repeats += 1;
    seen.add(key);
  }
  return repeats / wears.length;
}
