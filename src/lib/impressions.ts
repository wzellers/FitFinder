// What the generator showed and what the user did with it (outfit_impressions),
// for measuring recommendations on real users; the recommendation_quality view
// summarizes it by week. Logging is best-effort: a failure never gets in the
// user's way.

import { supabase } from '@/lib/supabaseClient';

export type ImpressionOutcome = 'skipped' | 'rated' | 'worn' | 'saved';

/** Log a shown outfit. Resolves to the row id, or null if it couldn't be saved. */
export async function logImpression(
  userId: string,
  outfit: { top: { id: string }; bottom: { id: string }; shoes: { id: string } },
  predicted: number,
  modelRatings: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('outfit_impressions')
    .insert({
      user_id: userId,
      top_id: outfit.top.id,
      bottom_id: outfit.bottom.id,
      shoes_id: outfit.shoes.id,
      predicted: Math.min(1, Math.max(0, predicted)),
      model_ratings: modelRatings,
    })
    .select('id')
    .single();
  if (error || !data) {
    console.warn('Could not log outfit impression', error);
    return null;
  }
  return (data as { id: string }).id;
}

/** Record what happened to a shown outfit. Takes the pending id from
 * `logImpression`, so it can be called before the insert has finished. */
export async function recordOutcome(
  impression: Promise<string | null>,
  outcome: ImpressionOutcome,
  rating?: number,
): Promise<void> {
  const id = await impression;
  if (!id) return;
  const { error } = await supabase
    .from('outfit_impressions')
    .update({ outcome, rating: rating ?? null, outcome_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.warn('Could not record outfit outcome', error);
}
