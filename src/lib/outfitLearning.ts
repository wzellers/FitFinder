// Keep the outfit model in step with what the user has worn and rated.
//
// Each outfit_wears row records the features the model learned from
// (`features`) and the rating it learned (`learned_rating`). Whenever a wear's
// rating or items change (rating prompt, Calendar), `syncWearLearning` undoes
// what was learned before and learns the current rating, so edits never
// double-count. Features come from the row when it was logged with "Wear today"
// (the outfit as it actually was that day), or are rebuilt as of the wear's
// date from the user's history.

import { supabase } from '@/lib/supabaseClient';
import { throwIfAnyError } from '@/lib/supabaseResult';
import { FEATURE_NAMES, featureVector } from '@/lib/outfitScoring';
import {
  computeReward,
  deserializeModel,
  forgetReward,
  serializeModel,
  updateWeights,
  type BanditModel,
  type FeatureVector,
} from '@/lib/banditModel';
import type { ClothingItem, ColorCombination, OutfitWear } from '@/lib/types';

// ============================================================================
// Stored features
// ============================================================================

type ItemIds = [string | null, string | null, string | null];

/** `outfit_wears.features`: the feature vector and the items it describes. */
export interface WearFeatures {
  items: ItemIds;
  values: FeatureVector;
}

export const wearItems = (w: {
  top_id?: string | null;
  bottom_id?: string | null;
  shoes_id?: string | null;
}): ItemIds => [w.top_id ?? null, w.bottom_id ?? null, w.shoes_id ?? null];

const sameItems = (a: ItemIds, b: ItemIds) => a.every((id, i) => id === b[i]);

/** Read a stored `features` value, or null if it is missing or malformed. */
export function parseWearFeatures(raw: unknown): WearFeatures | null {
  if (!raw || typeof raw !== 'object') return null;
  const { items, values } = raw as Partial<WearFeatures>;
  if (!Array.isArray(items) || items.length !== 3) return null;
  if (!values || typeof values !== 'object') return null;
  const ok = FEATURE_NAMES.every(
    (n) => typeof values[n] === 'number' && Number.isFinite(values[n]),
  );
  return ok ? { items: items as ItemIds, values } : null;
}

// ============================================================================
// The decision (pure)
// ============================================================================

export interface LearningRow {
  top_id?: string | null;
  bottom_id?: string | null;
  shoes_id?: string | null;
  rating?: number | null;
  features?: unknown;
  learned_rating?: number | null;
}

export interface Relearned {
  model: BanditModel;
  features: WearFeatures | null;
  learnedRating: number | null;
}

/**
 * Bring `model` in line with a wear's current rating and items. Returns null
 * when nothing needs to change. `rebuild` computes the outfit's features when
 * the stored ones don't describe its current items (it is only called then).
 */
export function relearn(
  model: BanditModel,
  row: LearningRow,
  rebuild: () => FeatureVector | null,
): Relearned | null {
  const items = wearItems(row);
  const stored = parseWearFeatures(row.features);
  const learned =
    row.learned_rating != null && stored
      ? { values: stored.values, rating: row.learned_rating }
      : null;
  const rating = row.rating ?? null;
  const storedFits = stored !== null && sameItems(stored.items, items);

  if (learned && storedFits && learned.rating === rating) return null; // in sync
  if (!learned && rating === null) return null; // nothing learned, nothing to learn

  let next = model;
  if (learned) next = forgetReward(next, learned.values, computeReward(learned.rating));

  const complete = items.every((id) => id !== null);
  const values = storedFits ? stored.values : complete ? rebuild() : null;
  if (rating !== null && values && complete) {
    return {
      model: updateWeights(next, values, computeReward(rating)),
      features: { items, values },
      learnedRating: rating,
    };
  }
  return { model: next, features: values ? { items, values } : stored, learnedRating: null };
}

// ============================================================================
// Supabase wiring
// ============================================================================

const WEAR_COLUMNS =
  'id, worn_date, top_id, bottom_id, shoes_id, occasion, rating, features, learned_rating';

async function saveModel(userId: string, model: BanditModel) {
  const serialized = serializeModel(model);
  const { error } = await supabase.from('outfit_model_weights').upsert({
    user_id: userId,
    weights: serialized.weights,
    feature_meta: serialized.feature_meta,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Rebuild a wear's features as of its date, from the user's history. */
async function rebuildFeatures(userId: string, wear: OutfitWear): Promise<FeatureVector | null> {
  const ids = wearItems(wear).filter((id): id is string => id !== null);
  const since = new Date(new Date(wear.worn_date).getTime() - 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const [{ data: items }, { data: recent }, { data: rated }, { data: color }] = throwIfAnyError(
    await Promise.all([
      supabase.from('clothing_items').select('*').in('id', ids),
      supabase
        .from('outfit_wears')
        .select('*')
        .eq('user_id', userId)
        .gte('worn_date', since)
        .lt('worn_date', wear.worn_date),
      supabase
        .from('outfit_wears')
        .select('*')
        .eq('user_id', userId)
        .lt('worn_date', wear.worn_date)
        .not('rating', 'is', null)
        .order('worn_date', { ascending: false })
        .limit(100),
      supabase
        .from('color_preferences')
        .select('liked_combinations')
        .eq('user_id', userId)
        .maybeSingle(),
    ]),
  );
  const byId = new Map(((items ?? []) as ClothingItem[]).map((i) => [i.id, i]));
  const top = byId.get(wear.top_id ?? '');
  const bottom = byId.get(wear.bottom_id ?? '');
  const shoes = byId.get(wear.shoes_id ?? '');
  if (!top || !bottom || !shoes) return null;

  return featureVector(
    { top, bottom, shoes },
    {
      likedCombinations: (color?.liked_combinations ?? []) as ColorCombination[],
      recentWears: (recent ?? []) as OutfitWear[],
      ratedOutfits: (rated ?? []) as OutfitWear[],
      asOf: wear.worn_date,
    },
  );
}

async function loadModel(userId: string): Promise<BanditModel> {
  const { data, error } = await supabase
    .from('outfit_model_weights')
    .select('weights, feature_meta')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return deserializeModel(data);
}

/**
 * Bring the user's model in line with one wear's current rating and items
 * (call after saving the wear). Best-effort: callers should catch and log.
 */
export async function syncWearLearning(userId: string, wearId: string): Promise<void> {
  const { data: wear, error } = await supabase
    .from('outfit_wears')
    .select(WEAR_COLUMNS)
    .eq('id', wearId)
    .maybeSingle();
  if (error) throw error;
  if (!wear) return;

  // Cheap check first: most calls (e.g. editing notes) change nothing.
  if (relearn(deserializeModel(null), wear, () => null) === null) return;

  let rebuilt: FeatureVector | null = null;
  const needsRebuild = (() => {
    const stored = parseWearFeatures(wear.features);
    return !(stored && sameItems(stored.items, wearItems(wear)));
  })();
  if (needsRebuild) rebuilt = await rebuildFeatures(userId, wear as OutfitWear);

  const result = relearn(await loadModel(userId), wear, () => rebuilt);
  if (!result) return;
  await saveModel(userId, result.model);
  const { error: updateError } = await supabase
    .from('outfit_wears')
    .update({ features: result.features, learned_rating: result.learnedRating })
    .eq('id', wearId);
  if (updateError) throw updateError;
}

/** Undo what the model learned from a wear (call before deleting it). */
export async function forgetWearLearning(userId: string, wearId: string): Promise<void> {
  const { data: wear, error } = await supabase
    .from('outfit_wears')
    .select(WEAR_COLUMNS)
    .eq('id', wearId)
    .maybeSingle();
  if (error) throw error;
  const stored = parseWearFeatures(wear?.features);
  if (!wear || wear.learned_rating == null || !stored) return;
  const model = forgetReward(
    await loadModel(userId),
    stored.values,
    computeReward(wear.learned_rating),
  );
  await saveModel(userId, model);
}
