// Contextual bandit — online linear model over the five outfit features.
//
// This is the learning layer on top of Phase 3's deterministic scorer. It learns
// one weight per feature in `FEATURE_NAMES` (plus a bias) via online linear
// regression, and selects outfits with ε-greedy explore/exploit. The fixed
// `FEATURE_WEIGHTS` from `outfitScoring.ts` serve as the cold-start weights, so
// before any rating the bandit reproduces the deterministic scorer's behavior.
//
// Pure logic only: no Supabase, no React. Persistence and UI wiring live with the
// callers, which keeps this module trivially unit-testable.

import { FEATURE_NAMES, FEATURE_WEIGHTS } from '@/lib/outfitScoring';
import type { FeatureName } from '@/lib/outfitScoring';

// ============================================================================
// TYPES
// ============================================================================

export type FeatureVector = Record<FeatureName, number>;

export interface BanditWeights {
  /** One weight per feature, in `FEATURE_NAMES`. */
  weights: Record<FeatureName, number>;
  /** Intercept term, learned alongside the feature weights. */
  bias: number;
}

export interface ModelMeta {
  /** Schema version, so stored weights can be migrated later. */
  version: number;
  /** Number of online updates applied — useful for diagnostics / decaying ε. */
  updates: number;
}

export interface BanditModel {
  params: BanditWeights;
  meta: ModelMeta;
}

export const MODEL_VERSION = 1;

/** Default online learning rate for `updateWeights`. */
export const DEFAULT_LEARNING_RATE = 0.05;

/** Default exploration rate for ε-greedy selection. */
export const DEFAULT_EPSILON = 0.15;

// ============================================================================
// COLD START
// ============================================================================

/**
 * Cold-start model: feature weights seeded from the deterministic scorer's fixed
 * `FEATURE_WEIGHTS` and zero bias. With these weights, `predict` equals the
 * Phase 3 score, so behavior is identical until the first rating arrives.
 */
export function defaultModel(): BanditModel {
  const weights = {} as Record<FeatureName, number>;
  for (const name of FEATURE_NAMES) weights[name] = FEATURE_WEIGHTS[name];
  return {
    params: { weights, bias: 0 },
    meta: { version: MODEL_VERSION, updates: 0 },
  };
}

/**
 * Normalize a loaded/persisted model: fills in any missing feature weights from
 * the cold-start defaults and tolerates an absent meta block. Used when reading
 * weights that may predate a feature being added.
 */
export function normalizeModel(loaded: Partial<BanditModel> | null | undefined): BanditModel {
  const base = defaultModel();
  if (!loaded || !loaded.params) return base;
  const weights = { ...base.params.weights };
  for (const name of FEATURE_NAMES) {
    const v = loaded.params.weights?.[name];
    if (typeof v === 'number' && Number.isFinite(v)) weights[name] = v;
  }
  const bias =
    typeof loaded.params.bias === 'number' && Number.isFinite(loaded.params.bias)
      ? loaded.params.bias
      : base.params.bias;
  return {
    params: { weights, bias },
    meta: {
      version: loaded.meta?.version ?? MODEL_VERSION,
      updates: loaded.meta?.updates ?? 0,
    },
  };
}

// ============================================================================
// PERSISTENCE (pure (de)serialization — Supabase calls live in the callers)
// ============================================================================

/** Shape of the `outfit_model_weights` row's JSON columns. */
export interface SerializedModel {
  /** Feature weights plus the bias term (under `__bias`), flattened into one object. */
  weights: Record<string, number>;
  feature_meta: ModelMeta;
}

/** Convert a model to the JSON stored in `outfit_model_weights`. */
export function serializeModel(model: BanditModel): SerializedModel {
  return {
    weights: { ...model.params.weights, __bias: model.params.bias },
    feature_meta: { ...model.meta },
  };
}

/**
 * Rebuild a model from a stored row (or partial/legacy data). Missing or invalid
 * fields fall back to cold-start defaults via `normalizeModel`.
 */
export function deserializeModel(row: Partial<SerializedModel> | null | undefined): BanditModel {
  if (!row || !row.weights) return defaultModel();
  const { __bias, ...featureWeights } = row.weights;
  return normalizeModel({
    params: {
      weights: featureWeights as Record<FeatureName, number>,
      bias: typeof __bias === 'number' ? __bias : 0,
    },
    meta: row.feature_meta,
  });
}

// ============================================================================
// PREDICTION
// ============================================================================

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Raw linear prediction (bias + w·features), unclamped. */
export function rawScore(params: BanditWeights, features: FeatureVector): number {
  let sum = params.bias;
  for (const name of FEATURE_NAMES) sum += params.weights[name] * features[name];
  return sum;
}

/** Predicted reward in [0, 1] for an outfit's feature vector. */
export function predict(params: BanditWeights, features: FeatureVector): number {
  return clamp01(rawScore(params, features));
}

// ============================================================================
// REWARD
// ============================================================================

/** Map a 1–10 outfit rating to a reward in [0, 1]. */
export function computeReward(rating: number): number {
  const r = (rating - 1) / 9; // 1 → 0, 10 → 1
  return clamp01(r);
}

/** Mild positive reward for an outfit the user explicitly saved. */
export const SAVED_OUTFIT_REWARD = 0.7;

// ============================================================================
// ONLINE UPDATE
// ============================================================================

/**
 * One online linear-regression step toward `reward`:
 *   error = reward − predict(features)
 *   w_i  += lr · error · feature_i
 *   bias += lr · error
 * Returns a NEW model (does not mutate the input) with `meta.updates` incremented.
 */
export function updateWeights(
  model: BanditModel,
  features: FeatureVector,
  reward: number,
  learningRate: number = DEFAULT_LEARNING_RATE,
): BanditModel {
  const error = reward - predict(model.params, features);
  const weights = { ...model.params.weights };
  for (const name of FEATURE_NAMES) {
    weights[name] = model.params.weights[name] + learningRate * error * features[name];
  }
  const bias = model.params.bias + learningRate * error;
  return {
    params: { weights, bias },
    meta: { version: model.meta.version, updates: model.meta.updates + 1 },
  };
}

// ============================================================================
// ε-GREEDY SELECTION
// ============================================================================

export interface ScoredCandidate<T> {
  candidate: T;
  features: FeatureVector;
  score: number;
}

/**
 * ε-greedy selection over featurized candidates.
 *
 * With probability ε the model "explores" by shuffling all candidates randomly;
 * otherwise it "exploits" by sorting on predicted reward. Either way the top
 * `count` distinct candidates are returned, each tagged with its predicted score.
 *
 * `rng` is injectable (defaults to `Math.random`) so tests can make selection
 * deterministic.
 */
export function selectOutfits<T>(
  candidates: { candidate: T; features: FeatureVector }[],
  params: BanditWeights,
  options: { epsilon?: number; count?: number; rng?: () => number } = {},
): ScoredCandidate<T>[] {
  const { epsilon = DEFAULT_EPSILON, count = 5, rng = Math.random } = options;

  const scored: ScoredCandidate<T>[] = candidates.map((c) => ({
    candidate: c.candidate,
    features: c.features,
    score: predict(params, c.features),
  }));

  const explore = rng() < epsilon;
  if (explore) {
    // Fisher–Yates shuffle using the injected RNG.
    const a = [...scored];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, count);
  }

  // Exploit: highest predicted reward first; jittered ties so equal-score
  // outfits don't always come back in the same order.
  scored.sort((x, y) => (y.score !== x.score ? y.score - x.score : rng() - 0.5));
  return scored.slice(0, count);
}
