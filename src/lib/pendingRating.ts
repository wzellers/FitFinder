// The "rate yesterday's outfit" prompt: which worn outfit, if any, still
// needs a rating.
//
// A day needs one when its outfit_wears row has no rating and the same outfit
// wasn't already rated from the Outfits tab (outfit_ratings) on or after that
// day, so the prompt never asks for a rating the user has already given.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PendingRating } from '@/lib/types';

export async function findPendingRating(
  db: SupabaseClient,
  userId: string,
  date: string,
): Promise<PendingRating | null> {
  const { data: wears } = await db
    .from('outfit_wears')
    .select('*')
    .eq('user_id', userId)
    .eq('worn_date', date)
    .is('rating', null)
    .limit(1);
  const wear = wears?.[0];
  if (!wear) return null;

  if (wear.top_id && wear.bottom_id && wear.shoes_id) {
    const { data: ratings } = await db
      .from('outfit_ratings')
      .select('id')
      .eq('user_id', userId)
      .eq('top_id', wear.top_id)
      .eq('bottom_id', wear.bottom_id)
      .eq('shoes_id', wear.shoes_id)
      .gte('rated_on', wear.worn_date)
      .limit(1);
    if (ratings && ratings.length > 0) return null;
  }

  return {
    wear_id: wear.id,
    worn_date: wear.worn_date,
    occasion: wear.occasion ?? null,
    outfit_items: {
      top_id: wear.top_id ?? undefined,
      bottom_id: wear.bottom_id ?? undefined,
      shoes_id: wear.shoes_id ?? undefined,
    },
  };
}
