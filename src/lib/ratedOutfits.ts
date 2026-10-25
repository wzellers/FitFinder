// The user's rated outfits, worn or not, for the "rating" feature (the
// model's memory of well-rated items).
//
// Ratings come from two places: worn outfits (outfit_wears.rating, from the
// rating prompt or the Calendar) and outfits rated without wearing them
// (outfit_ratings, from the Outfits tab). The rating feature reads both the
// same way, so they're merged into OutfitWear-shaped rows.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OutfitWear } from '@/lib/types';

/** A row of `outfit_ratings`. */
export interface OutfitRatingRow {
  id: string;
  user_id: string;
  top_id: string;
  bottom_id: string;
  shoes_id: string;
  rating: number;
  rated_on: string;
}

/** Most recent rated outfits the rating feature looks at. */
export const RATED_OUTFITS_LIMIT = 100;

/** Merge worn and browsing ratings, newest first, keeping at most `limit`. */
export function mergeRatedOutfits(
  wears: OutfitWear[],
  ratings: OutfitRatingRow[],
  limit = RATED_OUTFITS_LIMIT,
): OutfitWear[] {
  const asWears: OutfitWear[] = ratings.map((r) => ({
    id: `rating-${r.id}`,
    user_id: r.user_id,
    top_id: r.top_id,
    bottom_id: r.bottom_id,
    shoes_id: r.shoes_id,
    rating: r.rating,
    worn_date: r.rated_on,
  }));
  return [...wears.filter((w) => typeof w.rating === 'number'), ...asWears]
    .sort((a, b) => (a.worn_date < b.worn_date ? 1 : a.worn_date > b.worn_date ? -1 : 0))
    .slice(0, limit);
}

/**
 * Load a user's rated outfits (worn and not), newest first. With `before`,
 * only those from before that date, e.g. to rebuild a past day's features.
 */
export async function loadRatedOutfits(
  db: SupabaseClient,
  userId: string,
  { before, limit = RATED_OUTFITS_LIMIT }: { before?: string; limit?: number } = {},
): Promise<OutfitWear[]> {
  let wears = db
    .from('outfit_wears')
    .select('*')
    .eq('user_id', userId)
    .not('rating', 'is', null)
    .order('worn_date', { ascending: false })
    .limit(limit);
  let ratings = db
    .from('outfit_ratings')
    .select('id, user_id, top_id, bottom_id, shoes_id, rating, rated_on')
    .eq('user_id', userId)
    .order('rated_on', { ascending: false })
    .limit(limit);
  if (before) {
    wears = wears.lt('worn_date', before);
    ratings = ratings.lt('rated_on', before);
  }
  const [w, r] = await Promise.all([wears, ratings]);
  if (w.error) throw new Error(`rated wears: ${w.error.message}`);
  if (r.error) throw new Error(`outfit ratings: ${r.error.message}`);
  return mergeRatedOutfits(
    (w.data ?? []) as OutfitWear[],
    (r.data ?? []) as OutfitRatingRow[],
    limit,
  );
}
