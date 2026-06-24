// Occasion rule loader — merges a user's saved occasion preferences over the
// built-in defaults. Mirrors `getUserClothingWeatherRules` in weatherApi.ts.
// Pure: no Supabase, so it's trivially unit-testable.

import { occasionRules as defaultOccasionRules } from '@/lib/constants';
import type { OccasionRules } from '@/lib/outfitScoring';

/** User-overridden occasion rules merged over the defaults, or just defaults. */
export function getUserOccasionRules(userRules?: OccasionRules | null): OccasionRules {
  if (!userRules) return defaultOccasionRules;
  return { ...defaultOccasionRules, ...userRules };
}
